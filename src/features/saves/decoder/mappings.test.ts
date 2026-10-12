import type { Building } from '@/app/uklad/model';
// @vitest-environment node
import { expect, it, vi } from 'vitest';
import buildings from '../../../../assets/game-data/update2_QoL/buildings_and_recipes.json';
import items from '../../../../assets/game-data/update2_QoL/items_catalog.json';
import buildingMappings from '../../../../assets/game-data/update2_QoL/save_buildings_mappings.json';
import itemMappings from '../../../../assets/game-data/update2_QoL/save_items_mappings.json';
import recipeMappings from '../../../../assets/game-data/update2_QoL/save_recipes_mappings.json';
import { loadHeadlessSaveMappings } from '@/platform/headless/game-data-loader';
import { DATA_VERSIONS } from '@/features/app-shell/data-version';
import { loadSaveDecodeContext, loadSaveMappings, parseSaveMappings } from './mappings';
import { analyzeSave } from './analyze';
import { extractionContext, saveEntity, saveFixture, transportFixture } from './test-fixture';

it('loads compact mappings whose identities all exist in the matching app catalogs', async () => {
    const mappings = await loadHeadlessSaveMappings('update2_QoL');
    expect(mappings.buildings.size).toBe(43);
    expect(mappings.items.size).toBe(104);
    for (const { id } of mappings.buildings.values()) expect(buildings.some(building => building.id === id)).toBe(true);
    for (const id of mappings.items.values()) expect(items.some(item => item.id === id)).toBe(true);
    expect([...mappings.buildings.values()].map(mapping => mapping.id)).not.toContain('drone_rail');
    expect([...mappings.buildings.values()].map(mapping => mapping.id)).not.toContain('drone_merger_3_to_1');
    let count = 0;
    for (const [buildingId, recipes] of mappings.recipes) {
        const building = buildings.find(building => building.id === buildingId)!;
        for (const mapping of recipes.values()) {
            const recipe = building.recipes!.find((recipe, index) => `${buildingId}:${'id' in recipe ? recipe.id : index}` === mapping.catalogRecipeId)!;
            expect(recipe).toBeDefined();
            expect(recipe.output.id).toBe(mapping.outputItemId);
            expect(recipe.inputs.map(input => input.id).sort()).toEqual(mapping.inputItemIds);
            expect('variant' in recipe ? recipe.variant : 'default').toBe(mapping.variant);
            count++;
        }
    }
    expect(count).toBe(146);
});

it('maps exact building versions and renamed item identities', () => {
    const save = transportFixture();
    Object.assign(save.itemData.Mass.entities, {
        '(ID=50)': saveEntity('SolarPowerGeneratorTier2/DA_SolarPowerGeneratorTier2.DA_SolarPowerGeneratorTier2', 0),
    });
    const item = "/Game/Chimera/Items/I_Syringe.I_Syringe_C'/Game/Chimera/Items/I_Syringe.Default__I_Syringe_C'";
    save.itemData.CrPackageTransportReplicator.senderConnections['(ID=20)'] = { receiver: { iD: 30 }, item };
    save.itemData.CrPackageTransportReplicator.senderConnections['(ID=21)'] = { receiver: { iD: 31 }, item: item.replace('Default__I_Syringe', 'Default__I_Accumulator') };
    const snapshot = analyzeSave(save, extractionContext);
    const instances = snapshot.cores.flatMap(core => core.buildings);
    expect(instances.find(building => building.id === 50)?.buildingTypeId).toBe('solar_generator_v2');
    expect(instances.find(building => building.id === 20)?.configuration).toMatchObject({ itemId: 'applicator' });
    expect(instances.find(building => building.id === 21)?.configuration).toMatchObject({ itemId: null });
});
it('does not import assets absent from the supported catalog', () => {
    expect(analyzeSave(saveFixture(), { ...extractionContext, buildingIds: new Set() }).cores).toEqual([]);
});

it.each(DATA_VERSIONS.filter(version => version.id !== 'update2_QoL'))('does not reuse current mappings for $id', async ({ id }) => {
    const readJson = vi.fn(async () => buildingMappings);
    await expect(loadSaveMappings(id, readJson)).rejects.toMatchObject({ code: 'mappings' });
    expect(readJson).toHaveBeenCalledTimes(3);
});

it('rejects mismatched versions, builds, and malformed identities before decoding a save', () => {
    for (const patch of [
        { schemaVersion: 2 }, { appDataVersion: 'update1' }, { steamBuildId: 'other' },
        { mappings: { '/bad': { id: 'smelter', role: 'unrecognized' } } },
        { mappings: { '/bad': { id: null } } }, { mappings: null },
    ]) expect(() => parseSaveMappings('update2_QoL', { ...buildingMappings, ...patch }, itemMappings, recipeMappings)).toThrow();
    expect(() => parseSaveMappings('update2_QoL', buildingMappings, { ...itemMappings, mappings: { '/bad': 42 } }, recipeMappings)).toThrow();
});

it('surfaces missing or malformed mapping files as mapping errors', async () => {
    await expect(loadSaveMappings('update2_QoL', async () => { throw new Error('404'); })).rejects.toMatchObject({ code: 'mappings' });
    await expect(loadSaveMappings('update2_QoL', async () => ({}))).rejects.toMatchObject({ code: 'mappings' });
});

it('validates extraction metadata before it can contribute nominal rates', () => {
    const valid = { tier: 1, recipes: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { itemId: 'ore_titanium', purity: 'impure', ratePerMinute: 60 } } };
    for (const extractor of [
        { ...valid, tier: 0 }, { ...valid, tier: '2' }, { ...valid, recipes: null },
        ...[-1, Infinity, '60', undefined].map(ratePerMinute => ({ ...valid, recipes: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { itemId: 'ore_titanium', purity: 'impure', ratePerMinute } } })),
        { ...valid, recipes: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { itemId: 'ore_titanium', purity: 'super-pure', ratePerMinute: 60 } } },
        { ...valid, recipes: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { itemId: 'ore_titanium', purity: ['pure'], ratePerMinute: 60 } } },
    ]) expect(() => parseSaveMappings('update2_QoL', { ...buildingMappings, mappings: { '/extractor': { id: 'ore_excavator', tier: 1, extractor } } }, itemMappings, recipeMappings)).toThrow();
});

const mappingFiles: Record<string, unknown> = { 'save_buildings_mappings.json': buildingMappings,
    'save_items_mappings.json': itemMappings, 'save_recipes_mappings.json': recipeMappings,
    'buildings_and_recipes.json': buildings, 'items_catalog.json': items };

it('pins complete catalogs and rejects recipe-rate changes under the same dataset label', async () => {
    const context = await loadSaveDecodeContext({ dataVersion: 'update2_QoL', buildings: buildings as Building[], items }, async file => mappingFiles[file]);
    expect(context.mappings.catalogRevision).toBe(buildingMappings.catalogRevision);
    const changed = structuredClone(buildings);
    changed.find(building => building.id === 'smelter')!.recipes![0].output.amount_per_minute = 999;
    await expect(loadSaveDecodeContext({ dataVersion: 'update2_QoL', buildings: changed as Building[], items },
        async file => mappingFiles[file])).rejects.toMatchObject({ code: 'catalog' });
});

it('rejects incomplete, mixed-revision and changed mappings with controlled errors', async () => {
    for (const value of [undefined, { ...recipeMappings, mappingRevision: `sha256:${'0'.repeat(64)}` },
        { ...recipeMappings, mappings: { ...recipeMappings.mappings, smelter: {} } }]) {
        await expect(loadSaveMappings('update2_QoL', async file => file === 'save_recipes_mappings.json' ? value : mappingFiles[file]))
            .rejects.toMatchObject({ code: 'mappings' });
    }
});

it('validates exact production identities, variants and associated buildings/items', () => {
    for (const mappings of [
        { ghost: {} },
        { smelter: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { catalogRecipeId: 'fabricator:0', outputItemId: 'bar_titanium', inputItemIds: [], variant: 'default' } } },
        { smelter: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { catalogRecipeId: 'smelter:0', outputItemId: 'missing', inputItemIds: [], variant: 'default' } } },
        { smelter: { '/Game/Chimera/Crafting/CR_Test.CR_Test': { catalogRecipeId: 'smelter:0', outputItemId: 'bar_titanium', inputItemIds: [], variant: 'v2' } } },
    ]) expect(() => parseSaveMappings('update2_QoL', buildingMappings, itemMappings, { ...recipeMappings, mappings })).toThrow();
});

it('includes extractor rates in the pinned dataset fingerprint', async () => {
    const changed = structuredClone(buildingMappings);
    const drill = changed.mappings['/Game/Chimera/Buildings/MechanicalDrill/DA_MechanicalDrill.DA_MechanicalDrill'];
    Object.values(drill.extractor.recipes)[0].ratePerMinute += 1;
    await expect(loadSaveDecodeContext({ dataVersion: 'update2_QoL', buildings: buildings as Building[], items },
        async file => file === 'save_buildings_mappings.json' ? changed : mappingFiles[file])).rejects.toMatchObject({ code: 'mappings' });
});
