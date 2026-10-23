// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { createAppRuntime } from '@/app/uklad/runtime';
import { appIds } from '@/app/uklad/catalog';
import { registerHeadlessApplication } from '@/platform/headless/register';
import type { SaveSnapshot } from '@/features/saves/snapshot';
import type { AppVersionedGameData } from '@/app/uklad/model';
import { createSaveWorkspace } from '@/features/saves/workspace';
import { normalizePlannerTabs } from '@/platform/web/planner-tabs-storage';
import { normalizePlannerResources, saveResourceSnapshotKey } from './resources';

const revision = `sha256:${'a'.repeat(64)}`;
const data: AppVersionedGameData = {
    items: ['ore', 'plate', 'product', 'other'].map(id => ({ id, name: id, type: id === 'ore' ? 'raw' : 'processed' })),
    corporations: {},
    buildings: [
        { id: 'drill', name: 'Drill', type: 'production', recipes: [{ output: { id: 'ore', amount_per_minute: 60 }, inputs: [] }] },
        { id: 'factory', name: 'Factory', type: 'production', recipes: [
            { output: { id: 'plate', amount_per_minute: 20 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] },
            { output: { id: 'product', amount_per_minute: 10 }, inputs: [{ id: 'plate', amount_per_minute: 20 }] },
            { output: { id: 'other', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 5 }] },
        ] },
        { id: 'receiver', name: 'Receiver' }, { id: 'dispatcher', name: 'Dispatcher' },
    ],
    saveBuildingCatalog: { revision, kinds: { drill: 'extractor', factory: 'production', receiver: 'receiver', dispatcher: 'dispatcher' },
        extractionRates: { 'drill:ore:normal': 60, 'drill:ore:pure': 120 } },
};
function snapshot(): SaveSnapshot {
    const entity = { name: null, powerNetworkId: null, position: { x: 0, y: 0, z: 0 } };
    return { schemaVersion: 1, gameData: { version: 'playtest', revision }, savedAt: '20261015120000', cores: [
        { ...entity, id: 1, spawnTimeSeconds: 1, name: 'North', level: 0, bounds: null, buildings: [
            { ...entity, id: 10, buildingTypeId: 'drill', configuration: { kind: 'extractor', itemId: 'ore', nodePurity: 'normal' } },
            { ...entity, id: 11, buildingTypeId: 'factory', configuration: { kind: 'production', recipeId: null } },
            { ...entity, id: 12, buildingTypeId: 'dispatcher', configuration: { kind: 'dispatcher', itemId: 'plate', receiverId: 22 } },
            { ...entity, id: 13, buildingTypeId: 'receiver', configuration: { kind: 'receiver' } },
            { ...entity, id: 14, buildingTypeId: 'dispatcher', configuration: { kind: 'dispatcher', itemId: 'ore', receiverId: 13 } },
        ] },
        { ...entity, id: 2, spawnTimeSeconds: 2, name: 'South', level: 0, bounds: null, buildings: [
            { ...entity, id: 20, buildingTypeId: 'drill', configuration: { kind: 'extractor', itemId: 'ore', nodePurity: 'pure' } },
            { ...entity, id: 21, buildingTypeId: 'factory', configuration: { kind: 'production', recipeId: null } },
            { ...entity, id: 22, buildingTypeId: 'receiver', configuration: { kind: 'receiver' } },
            { ...entity, id: 23, buildingTypeId: 'receiver', configuration: { kind: 'receiver' } },
        ] },
    ] };
}
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => runtimes.splice(0).forEach(runtime => runtime.dispose()));
function setup() {
    const runtime = createAppRuntime(); runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(data)]);
    harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', snapshot()) }, savesWorkspaceOrder: ['world'] });
    harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'product']);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Plan', 'single']);
    const picker = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_PICKER, 'world'])!;
    const resources = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES]);
    const flow = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]);
    return { runtime, harness, picker, resources, flow };
}

describe('independent planner resources', () => {
    it('groups exact two- and three-Core coverage and imports each physical source only once', () => {
        const { harness, picker, resources } = setup();
        const world = snapshot();
        const [north, south] = world.cores;
        const bounds = (min: number, max: number) => ({ min: { x: min, y: -10, z: -10 }, max: { x: max, y: 10, z: 10 } });
        north.bounds = bounds(-10, 10); south.bounds = bounds(0, 20);
        for (const building of north.buildings) building.position = { x: -5, y: 0, z: 0 };
        for (const building of south.buildings) building.position = { x: 12, y: 0, z: 0 };
        north.buildings[0].position.x = 2;
        north.buildings[1].position.x = 7;
        for (const [id, x] of [[15, -5], [16, 7], [17, 17], [18, 22], [19, 2]]) {
            north.buildings.push({ ...north.buildings[0], id, position: { x, y: 0, z: 0 } });
        }
        world.cores.push({ ...south, id: 3, spawnTimeSeconds: 3, name: 'East', bounds: bounds(5, 25), buildings: [] });
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', world) } });
        const groups = picker().groups;
        expect(groups.map(group => [group.name, group.coreIds])).toEqual([
            ['North, South', [1, 2]], ['North, South, East', [1, 2, 3]], ['South, East', [2, 3]], ['North', [1]], ['East', [3]],
        ]);
        const ids = groups.flatMap(group => group.buildings.map(building => building.buildingId));
        expect(new Set(ids).size).toBe(ids.length);
        const select = (ids: number[]) => harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey,
            ids.map(buildingId => ({ buildingId }))]);
        select([10, 10]);
        expect(resources()).toMatchObject([{ coreIds: [1, 2], coreName: 'North, South', ratePerMinute: 60,
            source: { buildingIds: [10] } }]);
        // Another drill with the same item and rate is a distinct physical source.
        select([19, 10]);
        expect(resources()).toHaveLength(2);
        select(ids);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ ore: 480, plate: 240 });
        select(ids);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ ore: 480, plate: 240 });
        // A rename changes labels without resetting physical identity or copied quantities.
        const key = picker().snapshotKey;
        const renamed = structuredClone(harness.getState().savesWorkspaces.world);
        renamed.snapshot.cores[0].name = 'Renamed';
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: renamed } });
        expect(picker().snapshotKey).toBe(key);
        select(ids);
        expect(resources()[0].coreName).toBe('North, South');
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ ore: 480, plate: 240 });
        for (const coreIds of [[1], [2], [3], [1, 2, 3]]) {
            harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, coreIds]);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON]).rows[0].existing)
                .toBe(coreIds[0] === 1 && coreIds.length === 1 ? 1 : 2);
        }
    });

    it('detaches shared provenance, retains legacy rows, and rejects malformed coverage metadata', () => {
        const row = { id: 'resource-1', coreId: 1, coreIds: [1, 2, 3], coreName: 'North + South + East', itemId: 'ore', ratePerMinute: 60, enabled: true,
            source: { workspaceId: 'world', snapshotKey: saveResourceSnapshotKey(snapshot()), buildingIds: [10, 15] } };
        const normalized = normalizePlannerResources([row], true)[0];
        expect(normalized).toEqual(row);
        expect(normalized.coreIds).not.toBe(row.coreIds);
        expect(normalized.source?.buildingIds).not.toBe(row.source.buildingIds);
        const legacy = { id: 'legacy', coreId: 1, coreName: 'North', itemId: 'ore', ratePerMinute: 5, enabled: true };
        expect(normalizePlannerResources([legacy], true)).toEqual([legacy]);
        for (const invalid of [{ ...row, coreIds: [2, 3] }, { ...row, coreIds: [1, 1] },
            { ...row, source: { ...row.source, buildingIds: [10, 10] } }, { ...row, source: { ...row.source, buildingIds: [-1] } }]) {
            expect(() => normalizePlannerResources([invalid], true)).toThrow();
            expect(normalizePlannerResources([invalid])).toEqual([]);
        }
    });

    it('groups extractors per Core and item and remembers physical sources after rate edits', () => {
        const { harness, picker, resources } = setup();
        const expanded = snapshot();
        expanded.cores[0].buildings.push({ ...expanded.cores[0].buildings[0], id: 15 });
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', expanded) } });
        const select = (ids: number[], ratePerMinute?: number) => harness.dispatchSync([
            appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, ids.map(buildingId => ({ buildingId, ratePerMinute })),
        ]);
        select([10, 15, 10, 20]);
        expect(resources()).toMatchObject([
            { id: 'resource-1', coreId: 1, coreName: 'North', itemId: 'ore', ratePerMinute: 120, enabled: true },
            { id: 'resource-2', coreId: 2, coreName: 'South', itemId: 'ore', ratePerMinute: 120, enabled: true },
        ]);
        select([15, 10, 20]);
        expect(resources()).toHaveLength(2);
        // Editing or disabling an allocation does not make its sources available again.
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, 'resource-1', 90]);
        select([10, 15]);
        expect(resources()).toHaveLength(2);
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_ENABLED, 'resource-1', false]);
        select([10, 15]);
        expect(resources()).toHaveLength(2);
        // A replacement snapshot can provide a fresh allocation at a different amount.
        expanded.cores[0].name = 'Renamed';
        expanded.cores[0].spawnTimeSeconds = 99;
        expanded.cores[0].buildings[0].id = 99;
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'Replacement', expanded) } });
        select([99, 15]);
        expect(resources()).toHaveLength(3);
        // Same core and amount, different item remains independently addable.
        expanded.cores[0].buildings[0].configuration = { kind: 'extractor', itemId: 'plate', nodePurity: 'normal' };
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'Replacement', expanded) } });
        select([99], 120);
        expect(resources()[3]).toMatchObject({ coreId: 1, coreName: 'Renamed', itemId: 'plate', ratePerMinute: 120 });
        // Reject an invalid aggregate atomically, even when individual amounts are valid.
        select([15, 20], 1e9);
        const before = structuredClone(resources());
        expanded.cores[0].buildings[0].configuration = { kind: 'extractor', itemId: 'ore', nodePurity: 'normal' };
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'Replacement', expanded) } });
        select([99, 15], 1e9);
        expect(resources()).toEqual(before);
    });

    it('matches fractional totals and remains independent of save IDs', () => {
        const { harness, picker, resources } = setup();
        const expanded = snapshot();
        expanded.cores[0].buildings.push({ ...expanded.cores[0].buildings[0], id: 15 });
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', expanded) } });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10, ratePerMinute: 0.1 }, { buildingId: 15, ratePerMinute: 0.2 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, resources()[0].id, 0.3]);
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { other: createSaveWorkspace('other', 'Another world', expanded) }, savesWorkspaceOrder: ['other'], savesActiveWorkspaceId: 'other' });
        const other = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_PICKER, 'other'])!;
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'other', other.snapshotKey, [{ buildingId: 15, ratePerMinute: 0.2 }, { buildingId: 10, ratePerMinute: 0.1 }]]);
        expect(resources()).toHaveLength(1);
    });

    it('clears comparison on save or plan selection and rejects stale or foreign core selections', () => {
        const { harness, picker } = setup();
        const key = picker().snapshotKey;
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, [1]]);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([1]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', 'stale', [2]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, [999]]);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([1]);
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { ...harness.getState().savesWorkspaces, other: createSaveWorkspace('other', 'Other', snapshot()) } });
        harness.dispatchSync([appIds.events.SAVES_SELECT_WORKSPACE, 'other']);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, [1]]);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([]);
        harness.dispatchSync([appIds.events.SAVES_SELECT_WORKSPACE, 'world']);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, [1]]);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'other-plan', 'Other plan', 'single']);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, [1]]);
        harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'plan']);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([]);
    });

    it('selects incoming buildings across cores and edits allocations without duplicating sources', () => {
        const { harness, picker, resources } = setup();
        expect(picker().groups.map(core => core.buildings.map(building => building.buildingId))).toEqual([[10], [20, 22]]);
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore', 5]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }, { buildingId: 20 }]]);
        expect(resources()).toHaveLength(3);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ ore: 185 });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        expect(resources()).toHaveLength(3);
        const south = resources().find(row => row.coreId === 2)!;
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, south.id, 90]);
        expect(resources().find(row => row.id === south.id)).toMatchObject({ ratePerMinute: 90, coreId: 2, coreName: 'South' });
        expect(resources().find(row => row.coreId === undefined)?.ratePerMinute).toBe(5);
    });

    it('keeps resource rates but clears comparison after save replacement/removal and rejects stale selections', () => {
        const { harness, picker, resources, flow } = setup();
        const key = picker().snapshotKey;
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', key, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', key, [1, 2]]);
        const originalResources = structuredClone(resources());
        const originalFlow = structuredClone(flow());
        expect(harness.getState().plannerComparisonCoreIds).toEqual([1, 2]);
        const changed = snapshot(); changed.cores.shift(); changed.savedAt = '20261015130000';
        harness.restoreState({ ...harness.getState(), savesImport: { requestId: 10, targetWorkspaceId: 'world', phase: 'reading', fileName: 'new.sav', error: null } });
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, 10, changed]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', key, [{ buildingId: 20 }]]);
        expect(resources()).toEqual(originalResources);
        harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'world']);
        expect(resources()).toEqual(originalResources);
        expect(flow()).toEqual(originalFlow);
        expect(harness.getState().plannerComparisonCoreIds).toEqual([]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON])).toEqual({ coreNames: [], rows: [] });
    });

    it('adds resources after a save update while preserving previous allocations and rejecting duplicates', () => {
        const { harness, picker, resources } = setup();
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10, ratePerMinute: 35 }]]);
        const original = structuredClone(resources());
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, []]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 20 }, { buildingId: 999 }]]);
        expect(resources()).toEqual(original);
        const changed = snapshot(); changed.savedAt = '20261015130000';
        changed.cores[0].buildings[0].configuration = { kind: 'extractor', itemId: 'ore', nodePurity: 'pure' };
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', changed) } });
        expect(picker().groups[0].buildings[0]).toMatchObject({ capacity: 120 });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }, { buildingId: 20 }]]);
        expect(resources()).toHaveLength(3);
        expect(resources()[0]).toEqual(original[0]);
        expect(resources()[1]).toMatchObject({ ratePerMinute: 120, coreId: 1, coreName: 'North' });
        expect(resources()[2]).toMatchObject({ ratePerMinute: 120, coreId: 2, coreName: 'South' });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }, { buildingId: 20 }]]);
        expect(resources()).toHaveLength(3);
    });

    it('requires an entered rate for unknown capacity and excludes extractors from building comparison', () => {
        const { harness, picker, resources } = setup();
        const metadata = structuredClone(data.saveBuildingCatalog!);
        metadata.extractionRates['drill:ore:normal'] = null;
        harness.restoreState({ ...harness.getState(), savesBuildingCatalog: metadata });
        expect(picker().groups[0].buildings[0].capacity).toBeNull();
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        expect(resources()).toEqual([]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10, ratePerMinute: 5 }]]);
        expect(resources()[0]).toMatchObject({ ratePerMinute: 5, coreId: 1 });
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', picker().snapshotKey, [1]]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON]).rows).toEqual([
            { buildingTypeId: 'factory', name: 'Factory', existing: 1, planned: 2, additional: 1, spare: 0 },
        ]);
    });

    it('keeps final-target resources inactive and removes rows directly', () => {
        const { harness, resources } = setup();
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'plate', 10]);
        const row = resources()[0];
        harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'plate']);
        expect(resources()).toHaveLength(1);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({});
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_SUMMARY])[0]).toMatchObject({ isTarget: true, usedRate: 0 });
        harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'product']);
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_ENABLED, row.id, false]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({});
        harness.dispatchSync([appIds.events.PLANNER_REMOVE_RESOURCE, row.id]);
        expect(resources()).toEqual([]);
    });

    it('copies duplication deeply and treats game-version mismatch as picker incompatibility', () => {
        const { harness, picker, resources } = setup();
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', picker().snapshotKey, [1]]);
        const first = structuredClone(harness.getState().plannerTabs[0]);
        harness.dispatchSync([appIds.events.PLANNER_DUPLICATE_TAB, 'plan', 'copy']);
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, resources()[0].id, 42]);
        harness.dispatchSync([appIds.events.PLANNER_CLEAR_BUILDING_COMPARISON]);
        expect(harness.getState().plannerTabs[0]).toEqual(first);
        harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update1', structuredClone(data)]);
        expect(picker().compatible).toBe(false);
        const before = structuredClone(resources());
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 20 }]]);
        expect(resources()).toEqual(before);
    });

    it('fits a single target once without changing it on later resource edits', () => {
        const { harness, resources } = setup();
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore', 60]);
        const fit = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_FIT]);
        expect(fit).toMatchObject({ available: true, targetAmount: 20 });
        harness.dispatchSync([appIds.events.PLANNER_APPLY_RESOURCE_FIT]);
        expect(harness.getState().plannerTabs[0].targetAmount).toBe(20);
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, resources()[0].id, 120]);
        expect(harness.getState().plannerTabs[0].targetAmount).toBe(20);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_FIT]).targetAmount).toBe(40);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'multi', 'Multi', 'multi']);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_FIT]).reason).toBe('multi-target');
    });

    it('fits large resource rates without losing precision', () => {
        const { harness } = setup();
        const recipeData = structuredClone(data);
        recipeData.buildings.find(building => building.id === 'factory')!.recipes![1].inputs.push({ id: 'ore', amount_per_minute: 20 });
        harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', recipeData]);
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore', 999_900_000]);
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'plate', 1_000_000_000]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_FIT])).toMatchObject({
            targetAmount: 499_950_000,
        });
    });

    it('captures fallback names for blank save labels without losing snapshots during hydration', () => {
        const { harness, picker } = setup();
        const named = snapshot(); named.cores[0].name = '   '; named.cores[0].buildings[0].name = '   ';
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', named) } });
        expect(picker().groups[0]).toMatchObject({ name: 'Core 1', buildings: [{ buildingName: 'Drill' }] });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', picker().snapshotKey, [1]]);
        const plan = harness.getState().plannerTabs[0];
        expect(normalizePlannerTabs([plan])[0]).toEqual(plan);
        expect(plan.resources[0]).toMatchObject({ coreId: 1, coreName: 'Core 1' });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON]).coreNames).toEqual(['Core 1']);
    });

    it('migrates released input maps, preserves empty rows, and stores only allocation fields', () => {
        const { harness, picker } = setup();
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_COMPARISON_CORES, 'world', picker().snapshotKey, [1]]);
        const stored = structuredClone(harness.getState().plannerTabs[0]);
        Object.assign(stored.resources[0], { unknownField: 'discard' });
        Object.assign(stored, { unknownField: 'discard' });
        const normalized = normalizePlannerTabs([stored])[0];
        expect(Object.keys(normalized.resources[0]).sort()).toEqual(['coreId', 'coreName', 'enabled', 'id', 'itemId', 'ratePerMinute', 'source']);
        expect(normalized.resources[0].source).toEqual(stored.resources[0].source);
        expect(normalized.resources[0].source?.buildingIds).not.toBe(stored.resources[0].source?.buildingIds);
        expect(normalized).not.toHaveProperty('unknownField');
        stored.resources[0].coreName = 'Mutated';
        expect(normalized.resources[0].coreName).toBe('North');
        const legacy = { ...stored, resources: undefined, externalInputs: { ore: 60, bad: -1 } };
        expect(normalizePlannerTabs([legacy])[0].resources).toEqual([{ id: 'legacy-resource-1', itemId: 'ore', ratePerMinute: 60, enabled: true }]);
        expect(normalizePlannerTabs([{ ...legacy, resources: [] }])[0].resources).toEqual([]);
    });
});
