// @vitest-environment node
import { expect, it } from 'vitest';
import { saveLookups } from './decoder/test-fixture';
import { buildFactoryPlans } from './factory-plans';
import { createSaveGameData } from './game-data';
import { buildSaveOverview } from './overview';
import type { SaveBuilding, SaveBuildingConfiguration, SaveCore } from './snapshot';
import type { SaveWorkspace } from './types';

const position = { x: 0, y: 0, z: 0 };
function building(id: number, buildingTypeId: string, configuration: SaveBuildingConfiguration, powerNetworkId: number | null = 0): SaveBuilding {
    return { id, buildingTypeId, configuration, powerNetworkId, name: null, position };
}
const production = (id: number, recipeId: string, net = 0) =>
    building(id, recipeId.split(':')[0], { kind: 'production', recipeId }, net);
const drill = (id: number, network: number | null = 0) =>
    building(id, 'ore_excavator', { kind: 'extractor', itemId: 'ore_calcium', nodePurity: 'normal' }, network);
const refinery = () => [production(10, 'smelter:2'), production(11, 'fabricator:4'), production(12, 'furnace:1')];

function analyze(buildings: SaveBuilding[], data = saveLookups) {
    // Every building is physically covered by both Cores, regardless of its grid.
    const core: SaveCore = { id: 1, name: 'A', spawnTimeSeconds: 1, powerNetworkId: 0, level: null, position,
        bounds: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }, buildings };
    const world: SaveWorkspace = { id: 'world', name: 'World', schemaVersion: 1, snapshot: { schemaVersion: 1,
        gameData: { version: 'update2_QoL', revision: saveLookups.metadata!.revision }, savedAt: null,
        cores: [core, { ...core, id: 2, name: 'B', buildings: [] }] } };
    return buildFactoryPlans(buildSaveOverview(world, data), data);
}

it('fits both final products to shared ore and imported blocks without double-counting storage, internal freight or overlapping Cores', () => {
    const buildings = [...refinery(), drill(13), drill(14, null), production(15, 'smelter:2', 9),
        building(20, 'dispatcher', { kind: 'dispatcher', receiverId: 21, itemId: 'ore_calcium' }),
        building(21, 'receiver', { kind: 'receiver' }),
        building(22, 'dispatcher', { kind: 'dispatcher', receiverId: 23, itemId: 'block_calcium' }, 9),
        building(23, 'receiver', { kind: 'receiver' }),
        building(24, 'storage', { kind: 'storage', complete: true, items: { ore_calcium: 5000 }, space: null }),
        building(25, 'dispatcher', { kind: 'dispatcher', receiverId: 26, itemId: 'calcite_sheets' }, 9),
        building(26, 'receiver', { kind: 'receiver' }), // An imported final product is not a source for its own target.
    ];
    const [plan, sender] = analyze(buildings).plans;
    expect(plan.networkId).toBe(0);
    expect(plan.capacity).toEqual({ calcite_sheets: 60, powder_calcium: 60 });
    expect(sender.capacity).toEqual({ block_calcium: 60 }); // Its consumer is on a different network.
    expect(plan.resources.flatMap(row => row.source?.buildingIds).sort()).toEqual([13, 23]);
    expect(plan.resources.every(row => row.coreIds?.join() === '1,2')).toBe(true);
    // 360 blocks/min are available: 240 delivered and 120 made locally from ore.
    expect(plan.targetRates).toEqual({ calcite_sheets: 432, powder_calcium: 432 });
    // Imported blocks alone still cover the chain, up to the link's rate.
    expect(analyze(buildings.filter(b => b.id !== 13)).plans[0].targetRates).toEqual({ calcite_sheets: 288, powder_calcium: 288 });
});

it('shows a card only for a known network with a final product, even before its supply is complete', () => {
    const idle = building(12, 'fabricator', { kind: 'production', recipeId: null });
    const unknown = building(13, 'ore_excavator', { kind: 'extractor', itemId: 'ore_calcium', nodePurity: null });
    expect(analyze([drill(10), idle, unknown, building(14, 'smelter', { kind: 'production', recipeId: 'smelter:0' }, null)]).plans).toEqual([]);
    const [plan] = analyze([production(15, 'fabricator:4'), production(16, 'smelter:0'), drill(10), idle, unknown,
        building(17, 'dispatcher', { kind: 'dispatcher', receiverId: 18, itemId: 'ore_titanium' }, null),
        building(18, 'receiver', { kind: 'receiver' })]).plans;
    expect(plan.capacity).toEqual({ calcite_sheets: 60, bar_titanium: 60 });
    expect(plan.targetRates).toBeNull(); // Both targets must be covered by the same plan.
    expect(plan.warning?.values?.items).toBe('Titanium Ore');
    expect(analyze([production(16, 'smelter:0')]).plans[0].targetRates).toBeNull();
});

it('fits below, at, or above installed capacity according to the detected supply', () => {
    for (const count of [3, 4, 5]) {
        const machines = Array.from({ length: count }, (_, i) => production(i + 10, 'fabricator:4'));
        const [plan] = analyze([...machines, drill(25)]).plans;
        expect(plan.capacity.calcite_sheets).toBe(count * 60);
        expect(plan.targetRates).toEqual({ calcite_sheets: 240 });
    }
});

it('counts every machine but fits the recipe on the highest tier actually making the item', () => {
    const machines = [production(10, 'fabricator:11'), production(11, 'fabricator:11'), production(12, 'fabricator:11')];
    const deliveries = [
        building(20, 'dispatcher', { kind: 'dispatcher', itemId: 'titanium_housing', receiverId: 21 }, 9),
        building(21, 'receiver', { kind: 'receiver' }),
        building(22, 'dispatcher', { kind: 'dispatcher', itemId: 'wolfram_wire', receiverId: 23 }, 9),
        building(23, 'receiver', { kind: 'receiver' }),
    ];
    expect(analyze([...machines, ...deliveries]).plans[0].targetRates).toEqual({ stator: 120 });
    const [mixed] = analyze([...machines, production(13, 'craftertier2:6'), ...deliveries]).plans;
    expect(mixed).toMatchObject({ capacity: { stator: 100 }, targetRates: { stator: 240 }, recipeSelections: { stator: 'craftertier2:6' } });
    const tubes = [production(10, 'craftertier2:5'), production(11, 'craftertier2:tube_v2')];
    expect(analyze(tubes).plans[0].recipeSelections.tube).toBe('craftertier2:5');
    expect(analyze([...tubes, production(12, 'craftertier2:tube_v2')]).plans[0].recipeSelections.tube).toBe('craftertier2:tube_v2');
});

it('only falls back to a recipe configured on this network, and keeps a slow but supplied preferred recipe', () => {
    const titanium = building(13, 'ore_excavator', { kind: 'extractor', itemId: 'ore_titanium', nodePurity: 'normal' });
    const higher = production(11, 'craftertier2:5');
    const otherNetwork = production(12, 'fabricator:9', 9);
    expect(analyze([higher, otherNetwork, titanium]).plans[0].targetRates).toBeNull();

    const machines = [higher, production(10, 'fabricator:9'), titanium];
    const [fallback] = analyze(machines).plans;
    expect(fallback).toMatchObject({
        capacity: { tube: 600 }, recipeSelections: { tube: 'fabricator:9' }, targetRates: { tube: 320 },
    });
    expect(fallback.warning?.values?.items).toBe('Goethite Ore');

    const goethite = building(14, 'laserdrill', { kind: 'extractor', itemId: 'goethiteore', nodePurity: 'not-applicable' });
    const metadata = saveLookups.metadata!;
    const scarce = { ...saveLookups, metadata: { ...metadata, extractionRates: {
        ...metadata.extractionRates, 'laserdrill:goethiteore:not-applicable': 0.1,
    } } };
    expect(analyze([...machines, goethite], scarce).plans[0]).toMatchObject({
        recipeSelections: { tube: 'craftertier2:5' }, targetRates: { tube: 16 }, warning: null,
    });
});

it('uses one fallback for a shared ingredient, and keeps the preferred recipe if deliveries alone support the mix', () => {
    const machines = [production(10, 'fabricator:9'), production(11, 'craftertier2:5'),
        production(12, 'fabricator:12'), production(13, 'furnace:5'),
        building(14, 'ore_excavator', { kind: 'extractor', itemId: 'ore_titanium', nodePurity: 'normal' })];
    const delivery = (id: number, itemId: string) => [
        building(id, 'dispatcher', { kind: 'dispatcher', itemId, receiverId: id + 1 }, 9),
        building(id + 1, 'receiver', { kind: 'receiver' }),
    ];
    const sources = [...delivery(20, 'glass'), ...delivery(22, 'wolfram_wire'), ...delivery(24, 'ceramics')];
    expect(analyze([...machines, ...sources]).plans[0]).toMatchObject({
        recipeSelections: { tube: 'fabricator:9' }, targetRates: { applicator: 80, inductor: 80 },
    });
    expect(analyze([...machines, ...sources, ...delivery(26, 'tube')]).plans[0]).toMatchObject({
        recipeSelections: { tube: 'craftertier2:5' }, targetRates: { applicator: 60, inductor: 60 }, warning: null,
    });
});

it('keeps an identifiable final product visible when its planner recipe chain is circular', () => {
    const data = createSaveGameData([{ id: 'machine', name: 'Machine', recipes: [
        { output: { id: 'product', amount_per_minute: 10 }, inputs: [{ id: 'part', amount_per_minute: 10 }] },
        { output: { id: 'part', amount_per_minute: 10 }, inputs: [{ id: 'part', amount_per_minute: 10 }] },
        { output: { id: 'part', amount_per_minute: 5 }, inputs: [{ id: 'ore_calcium', amount_per_minute: 10 }] },
    ] }], [saveLookups.items.get('ore_calcium')!], saveLookups.metadata);
    const [plan] = analyze([production(10, 'machine:0'), production(11, 'machine:1')], data).plans;
    expect(plan.capacity).toEqual({ product: 10 });
    expect(plan.targetRates).toBeNull();
    expect(plan.warning?.key).toMatch(/circular/);
    expect(analyze([production(11, 'machine:1')], data).plans).toEqual([]);
    const [resolved] = analyze([production(10, 'machine:0'), production(11, 'machine:1'), production(12, 'machine:2'), drill(13)], data).plans;
    expect(resolved).toMatchObject({ recipeSelections: { part: 'machine:2' }, targetRates: { product: 60 } });
    expect(resolved.warning?.key).toMatch(/avoid a circular dependency/);
});
