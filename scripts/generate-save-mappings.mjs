import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Run with `node scripts/generate-save-mappings.mjs [export-directory]`.
// Only reviewed identities and recipe associations are published. Images and
// evidence stay in the internal exports. Saves use DA_ configs, not BD_ definitions.
const sourceDirectory = resolve(process.argv[2] ?? 'internal');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const [buildings, items] = await Promise.all(['buildings', 'items'].map(category =>
    readJson(resolve(sourceDirectory, `starrupture-${category}-mapped.json`))));
if (buildings.schemaVersion !== 1 || items.schemaVersion !== 1
    || buildings.appDataVersion !== items.appDataVersion || buildings.steamBuildId !== items.steamBuildId
    || !/^[a-zA-Z0-9_]+$/.test(buildings.appDataVersion)) {
    throw new Error('Mapping exports must use the same supported schema, game build, and app data version.');
}
const destination = resolve('assets/game-data', buildings.appDataVersion);
const [buildingCatalog, itemCatalog] = await Promise.all(['buildings_and_recipes.json', 'items_catalog.json']
    .map(file => readJson(resolve(destination, file))));
const tiers = { ore_excavator: 1, mechanicaldrilltier2: 2, fabricator: 1, craftertier2: 2,
    furnace: 1, furnacetier2: 2, factory: 1, factorytier2: 2, compounder: 1, synthetizertier2: 2 };
const roles = { BaseCore: 'core', PackageSender: 'dispatcher', PackageReceiver: 'receiver', Exporter: 'launcher', ExporterTier2: 'launcher' };
const extractors = {
    // User-provided tier/purity rates for this review iteration. V2's upgrade
    // factor varies with purity; never derive it with one blanket multiplier.
    ore_excavator: { tier: 1, folder: 'MechanicalDrill', rates: { impure: 60, normal: 120, pure: 240 } },
    mechanicaldrilltier2: { tier: 2, folder: 'MechanicalDrillTier2', rates: { impure: 180, normal: 300, pure: 480 } },
    helium_extractor: { tier: null }, sulfur_extractor: { tier: null },
    laserdrill: { tier: null }, liquidextractor: { tier: null },
};
function extractionMapping(building, catalogBuilding) {
    const config = extractors[building.appId];
    if (!config) return undefined;
    const recipes = new Map();
    for (const item of items.rows.filter(item => item.status === 'confirmed')) {
        const catalogRecipe = catalogBuilding.recipes?.find(recipe => recipe.output.id === item.appId && recipe.inputs.length === 0);
        if (!catalogRecipe) continue;
        for (const recipe of item.recipes ?? []) {
            if (recipe.role !== 'Output') continue;
            const listed = building.recipes?.some(entry => entry.key === recipe.key);
            const purityVariant = config.folder && recipe.key.startsWith(`/Game/Chimera/Crafting/${config.folder}/`);
            if (!listed && !purityVariant) continue;
            // Output identity is corroborated by the reviewed item export. A
            // missing purity suffix is an inferred normal node, never a rate.
            const purity = !config.folder ? 'not-applicable' : recipe.key.includes('OreImpure_') ? 'impure'
                : recipe.key.includes('OrePure_') ? 'pure' : 'normal';
            recipes.set(recipe.key, { itemId: item.appId, purity,
                ratePerMinute: config.folder ? config.rates[purity] : catalogRecipe.output.amount_per_minute });
        }
    }
    if (!recipes.size) throw new Error(`Missing extraction recipes: ${building.appId}`);
    return { tier: config.tier, recipes: Object.fromEntries([...recipes].sort(([a], [b]) => a.localeCompare(b))) };
}
const outputs = [];
for (const [category, exported, catalogFile] of [
    ['buildings', buildings, 'buildings_and_recipes.json'],
    ['items', items, 'items_catalog.json'],
]) {
    const catalog = new Map((catalogFile === 'buildings_and_recipes.json' ? buildingCatalog : itemCatalog).map(row => [row.id, row]));
    const mappings = new Map();
    for (const row of exported.rows) {
        if (row.status !== 'confirmed') continue;
        if (!catalog.has(row.appId)) throw new Error(`Unknown ${category} app ID: ${row.appId}`);
        let asset, mapping;
        if (category === 'buildings') {
            const match = /^(.*\/)BD_([^/.]+)\.BD_\2$/.exec(row.source);
            if (!match) throw new Error(`Unsupported building definition: ${row.source}`);
            asset = `${match[1]}DA_${match[2]}.DA_${match[2]}`;
            const role = roles[row.gameBuildingId?.replace('ECrBuildingID::', '')];
            mapping = { id: row.appId, tier: tiers[row.appId] ?? null, ...(role ? { role } : {}) };
            const extractor = extractionMapping(row, catalog.get(row.appId));
            if (extractor) mapping.extractor = extractor;
        } else {
            const match = /^(.*\/([^/.]+))\.\2_C$/.exec(row.source);
            const defaultObject = row.evidence?.nameSource;
            if (!match || defaultObject !== `${match[1]}.Default__${match[2]}_C`) {
                throw new Error(`Unsupported item reference: ${row.source}`);
            }
            asset = `${row.source}'${defaultObject}'`;
            mapping = row.appId;
        }
        if (mappings.has(asset)) throw new Error(`Duplicate ${category} asset: ${asset}`);
        mappings.set(asset, mapping);
    }
    const data = {
        schemaVersion: 1, appDataVersion: exported.appDataVersion, steamBuildId: exported.steamBuildId,
        mappings: Object.fromEntries([...mappings].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
    };
    outputs.push([resolve(destination, `save_${category}_mappings.json`), data]);
    console.log(`${category}: ${mappings.size} confirmed mappings; ${exported.rows.length - mappings.size} review entries omitted`);
}
const recipeMappings = {};
for (const building of buildings.rows.filter(row => row.status === 'confirmed')) {
    const catalogBuilding = buildingCatalog.find(row => row.id === building.appId);
    if (catalogBuilding.type !== 'production') continue;
    const recipes = {};
    for (const recipe of building.recipes ?? []) {
        const participatingItems = role => items.rows.filter(item => item.status === 'confirmed'
            && item.recipes?.some(entry => entry.key === recipe.key && entry.role === role)).map(item => item.appId).sort();
        const outputIds = participatingItems('Output'), inputItemIds = participatingItems('Input');
        const candidates = catalogBuilding.recipes.map((entry, index) => ({ entry, index })).filter(({ entry }) =>
            outputIds.length === 1 && entry.output.id === outputIds[0]
            && JSON.stringify(entry.inputs.map(input => input.id).sort()) === JSON.stringify(inputItemIds));
        if (candidates.length !== 1) throw new Error(`Unresolved recipe association: ${building.appId} ${recipe.key}`);
        const { entry, index } = candidates[0];
        if (recipes[recipe.key]) throw new Error(`Duplicate recipe: ${recipe.key}`);
        recipes[recipe.key] = { catalogRecipeId: `${building.appId}:${entry.id ?? index}`,
            outputItemId: outputIds[0], inputItemIds, variant: entry.variant ?? 'default' };
    }
    recipeMappings[building.appId] = Object.fromEntries(Object.entries(recipes).sort(([a], [b]) => a.localeCompare(b)));
}
const hash = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const catalogRevision = hash([buildingCatalog, itemCatalog]);
outputs.push([resolve(destination, 'save_recipes_mappings.json'), {
    schemaVersion: 1, appDataVersion: buildings.appDataVersion, steamBuildId: buildings.steamBuildId,
    mappings: Object.fromEntries(Object.entries(recipeMappings).sort(([a], [b]) => a.localeCompare(b))),
}]);
const mappingRevision = hash([catalogRevision, ...outputs.map(([, data]) => data)]);
// Validate both inputs before replacing either output.
for (const [path, data] of outputs) await writeFile(path, `${JSON.stringify({ ...data, mappingRevision, catalogRevision }, null, 2)}\n`);
console.log(`recipes: ${Object.values(recipeMappings).reduce((count, recipes) => count + Object.keys(recipes).length, 0)} exact production identities`);
