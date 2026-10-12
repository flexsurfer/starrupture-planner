import type { DataVersion } from '@/features/app-shell/data-version';
import { SaveImportError } from '../import-error';
import type { SaveDecodeContext, SaveDataContext } from './types';
import { sha256 } from './hash';

export type SaveBuildingRole = 'core' | 'dispatcher' | 'receiver' | 'launcher';
import type { SaveNodePurity } from '../snapshot';
export interface SaveExtractionRecipe {
    itemId: string;
    purity: SaveNodePurity;
    /** Unmodified tier/purity rate, or selected catalog rate for other extractors. */
    ratePerMinute: number | null;
}
export interface SaveExtractorMapping {
    tier: number | null;
    recipes: ReadonlyMap<string, SaveExtractionRecipe>;
}
export interface SaveProductionRecipeMapping {
    catalogRecipeId: string;
    outputItemId: string;
    inputItemIds: string[];
    variant: 'default' | 'alternative';
}
export interface SaveBuildingMapping { id: string; tier: number | null; role?: SaveBuildingRole; extractor?: SaveExtractorMapping }
export interface SaveMappings {
    dataVersion: DataVersion;
    steamBuildId: string;
    mappingRevision: string;
    catalogRevision: string;
    buildings: ReadonlyMap<string, SaveBuildingMapping>;
    items: ReadonlyMap<string, string>;
    recipes: ReadonlyMap<string, ReadonlyMap<string, SaveProductionRecipeMapping>>;
}

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid save mappings');
    return value as Record<string, unknown>;
}

function parseExtractor(value: unknown): SaveExtractorMapping {
    const extractor = record(value);
    if (extractor.tier !== null && (typeof extractor.tier !== 'number' || !Number.isSafeInteger(extractor.tier) || extractor.tier < 1)) {
        throw new Error('Invalid extractor tier');
    }
    return {
        tier: extractor.tier as number | null,
        recipes: new Map(Object.entries(record(extractor.recipes)).map(([asset, value]) => {
            const recipe = record(value);
            if (!asset.startsWith('/Game/Chimera/Crafting/') || typeof recipe.itemId !== 'string' || !recipe.itemId
                || typeof recipe.purity !== 'string' || !['impure', 'normal', 'pure', 'not-applicable'].includes(recipe.purity)
                || (recipe.ratePerMinute !== null && (typeof recipe.ratePerMinute !== 'number' || !Number.isFinite(recipe.ratePerMinute) || recipe.ratePerMinute <= 0))) {
                throw new Error('Invalid extraction recipe');
            }
            return [asset, { itemId: recipe.itemId, purity: recipe.purity as SaveNodePurity, ratePerMinute: recipe.ratePerMinute as number | null }];
        })),
    };
}

/** Validate external JSON before the pure decoder receives it. */
export function parseSaveMappings(version: DataVersion, buildingData: unknown, itemData: unknown, recipeData: unknown): SaveMappings {
    const buildings = record(buildingData), items = record(itemData), recipes = record(recipeData);
    if ([buildings, items, recipes].some(data => data.schemaVersion !== 1 || data.appDataVersion !== version)
        || typeof buildings.steamBuildId !== 'string' || !buildings.steamBuildId
        || typeof buildings.mappingRevision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(buildings.mappingRevision)
        || typeof buildings.catalogRevision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(buildings.catalogRevision)
        || [items, recipes].some(data => data.steamBuildId !== buildings.steamBuildId
            || data.mappingRevision !== buildings.mappingRevision || data.catalogRevision !== buildings.catalogRevision)) {
        throw new Error('Incompatible save mappings');
    }
    const mappings: SaveMappings = {
        dataVersion: version, steamBuildId: buildings.steamBuildId,
        mappingRevision: buildings.mappingRevision, catalogRevision: buildings.catalogRevision,
        buildings: new Map(Object.entries(record(buildings.mappings)).map(([asset, value]) => {
            const entry = record(value);
            if (typeof entry.id !== 'string' || !entry.id
                || (entry.tier !== null && (typeof entry.tier !== 'number' || !Number.isSafeInteger(entry.tier) || entry.tier < 1))
                || (entry.role !== undefined
                && entry.role !== 'core' && entry.role !== 'dispatcher' && entry.role !== 'receiver' && entry.role !== 'launcher')) {
                throw new Error('Invalid building save mapping');
            }
            return [asset, { id: entry.id, tier: entry.tier as number | null, ...(entry.role ? { role: entry.role } : {}),
                ...(entry.extractor === undefined ? {} : { extractor: parseExtractor(entry.extractor) }) }];
        })),
        items: new Map(Object.entries(record(items.mappings)).map(([asset, id]) => {
            if (typeof id !== 'string' || !id) throw new Error('Invalid item save mapping');
            return [asset, id];
        })),
        recipes: new Map(Object.entries(record(recipes.mappings)).map(([buildingId, value]) => [buildingId,
            new Map(Object.entries(record(value)).map(([asset, value]) => {
                const recipe = record(value);
                if (!asset.startsWith('/Game/Chimera/Crafting/') || typeof recipe.catalogRecipeId !== 'string'
                    || !recipe.catalogRecipeId.startsWith(`${buildingId}:`) || typeof recipe.outputItemId !== 'string' || !recipe.outputItemId
                    || !Array.isArray(recipe.inputItemIds) || recipe.inputItemIds.some(id => typeof id !== 'string' || !id)
                    || new Set(recipe.inputItemIds).size !== recipe.inputItemIds.length
                    || (recipe.variant !== 'default' && recipe.variant !== 'alternative')) throw new Error('Invalid production recipe mapping');
                return [asset, { catalogRecipeId: recipe.catalogRecipeId, outputItemId: recipe.outputItemId,
                    inputItemIds: [...recipe.inputItemIds] as string[], variant: recipe.variant }];
            })),
        ])),
    };
    const buildingIds = new Set([...mappings.buildings.values()].map(building => building.id));
    const itemIds = new Set(mappings.items.values());
    for (const [buildingId, entries] of mappings.recipes) {
        if (!buildingIds.has(buildingId)) throw new Error('Unknown recipe building');
        for (const recipe of entries.values()) if (!itemIds.has(recipe.outputItemId) || recipe.inputItemIds.some(id => !itemIds.has(id))) {
            throw new Error('Unknown recipe item');
        }
    }
    return mappings;
}

export async function loadSaveMappings(version: DataVersion, readJson: (file: string) => Promise<unknown>): Promise<SaveMappings> {
    try {
        const [buildings, items, recipes] = await Promise.all([
            readJson('save_buildings_mappings.json'), readJson('save_items_mappings.json'), readJson('save_recipes_mappings.json'),
        ]);
        const mappings = parseSaveMappings(version, buildings, items, recipes);
        const sources = [buildings, items, recipes].map(value => {
            const data = record(value);
            return { schemaVersion: data.schemaVersion, appDataVersion: data.appDataVersion,
                steamBuildId: data.steamBuildId, mappings: data.mappings };
        });
        const bytes = new TextEncoder().encode(JSON.stringify([mappings.catalogRevision, ...sources]));
        if (await sha256(bytes) !== mappings.mappingRevision) throw new Error('Changed save mappings');
        return mappings;
    } catch {
        throw new SaveImportError('mappings');
    }
}

function catalogIds(value: unknown): ReadonlySet<string> {
    if (!Array.isArray(value) || !value.length || value.length > 1000) throw new SaveImportError('catalog');
    const ids = new Set<string>();
    for (const entry of value) {
        const item = record(entry);
        if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new SaveImportError('catalog');
        ids.add(item.id);
    }
    return ids;
}

/** Decode against catalogs captured from the selected application state. */
export async function loadSaveDecodeContext(context: SaveDataContext, readJson: (file: string) => Promise<unknown>): Promise<SaveDecodeContext> {
    const mappings = await loadSaveMappings(context.dataVersion, readJson);
    const buildingIds = catalogIds(context.buildings), itemIds = catalogIds(context.items);
    const bytes = new TextEncoder().encode(JSON.stringify([context.buildings, context.items]));
    if (await sha256(bytes) !== mappings.catalogRevision) throw new SaveImportError('catalog');
    return { dataVersion: context.dataVersion, mappings, buildingIds, itemIds };
}
