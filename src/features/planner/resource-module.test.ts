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
    return { schemaVersion: 4, gameData: { version: 'playtest', revision }, savedAt: '20261015120000', cores: [
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

describe('planner resource snapshots', () => {
    it('selects incoming buildings across cores and edits allocations without duplicating sources', () => {
        const { harness, picker, resources } = setup();
        expect(picker().cores.map(core => core.buildings.map(building => building.buildingId))).toEqual([[10], [20, 22]]);
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore', 5]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }, { buildingId: 20 }]]);
        expect(resources()).toHaveLength(3);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ ore: 185 });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        expect(resources()).toHaveLength(3);
        const south = resources().find(row => row.origin?.buildingId === 20)!;
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, south.id, 90]);
        expect(resources().find(row => row.id === south.id)).toMatchObject({ ratePerMinute: 90, origin: { coreName: 'South' } });
        expect(resources().find(row => !row.origin)?.ratePerMinute).toBe(5);
    });

    it('keeps copied rates and comparison after save replacement/removal and rejects stale picker selection', () => {
        const { harness, picker, resources, flow } = setup();
        const key = picker().snapshotKey;
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', key, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_BUILDING_BASELINE, 'world', key, [1, 2]]);
        const originalResources = structuredClone(resources());
        const originalFlow = structuredClone(flow());
        const baseline = structuredClone(harness.getState().plannerTabs[0].buildingBaseline);
        const changed = snapshot(); changed.cores.shift(); changed.savedAt = '20261015130000';
        harness.restoreState({ ...harness.getState(), savesImport: { requestId: 10, targetWorkspaceId: 'world', phase: 'reading', fileName: 'new.sav', error: null } });
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, 10, changed]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', key, [{ buildingId: 20 }]]);
        expect(resources()).toEqual(originalResources);
        harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'world']);
        expect(resources()).toEqual(originalResources);
        expect(flow()).toEqual(originalFlow);
        expect(harness.getState().plannerTabs[0].buildingBaseline).toEqual(baseline);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON]).rows.find(row => row.buildingTypeId === 'factory')).toMatchObject({ existing: 2, planned: 2, additional: 0, spare: 0 });
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
        expect(picker().cores[0].buildings[0]).toMatchObject({ alreadyAdded: true, capacity: 120 });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }, { buildingId: 20 }]]);
        expect(resources()).toHaveLength(2);
        expect(resources()[0]).toEqual(original[0]);
        expect(resources()[1]).toMatchObject({ ratePerMinute: 120, origin: { coreName: 'South' } });
    });

    it('requires an entered rate for unknown capacity and excludes extractors from building comparison', () => {
        const { harness, picker, resources } = setup();
        const metadata = structuredClone(data.saveBuildingCatalog!);
        metadata.extractionRates['drill:ore:normal'] = null;
        harness.restoreState({ ...harness.getState(), savesBuildingCatalog: metadata });
        expect(picker().cores[0].buildings[0].capacity).toBeNull();
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        expect(resources()).toEqual([]);
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10, ratePerMinute: 5 }]]);
        expect(resources()[0]).toMatchObject({ ratePerMinute: 5, origin: { buildingId: 10 } });
        harness.dispatchSync([appIds.events.PLANNER_SET_BUILDING_BASELINE, 'world', picker().snapshotKey, [1]]);
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
        harness.dispatchSync([appIds.events.PLANNER_SET_BUILDING_BASELINE, 'world', picker().snapshotKey, [1]]);
        const first = structuredClone(harness.getState().plannerTabs[0]);
        harness.dispatchSync([appIds.events.PLANNER_DUPLICATE_TAB, 'plan', 'copy']);
        harness.dispatchSync([appIds.events.PLANNER_SET_RESOURCE_RATE, resources()[0].id, 42]);
        harness.dispatchSync([appIds.events.PLANNER_CLEAR_BUILDING_BASELINE]);
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
        expect(picker().cores[0]).toMatchObject({ name: 'Core 1', buildings: [{ buildingName: 'Drill' }] });
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_BUILDING_BASELINE, 'world', picker().snapshotKey, [1]]);
        const plan = harness.getState().plannerTabs[0];
        expect(normalizePlannerTabs([plan])[0]).toEqual(plan);
        expect(plan.resources[0].origin).toMatchObject({ coreName: 'Core 1', buildingName: 'Drill' });
        expect(plan.buildingBaseline?.coreNames).toEqual(['Core 1']);
    });

    it('migrates old resources, preserves explicit empty rows, and detaches durable snapshots', () => {
        const { harness, picker } = setup();
        harness.dispatchSync([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'world', picker().snapshotKey, [{ buildingId: 10 }]]);
        harness.dispatchSync([appIds.events.PLANNER_SET_BUILDING_BASELINE, 'world', picker().snapshotKey, [1]]);
        const stored = structuredClone(harness.getState().plannerTabs[0]);
        // Older resource drafts included save metadata; retain their allocations
        // while dropping the removed source-management fields during hydration.
        Object.assign(stored.resources[0].origin!, { groupId: 'old-group', workspaceName: 'Old save', savedAt: '20261015120000', snapshotKey: 'old', capacity: 60 });
        Object.assign(stored.buildingBaseline!, { workspaceId: 'world', workspaceName: 'Old save', savedAt: '20261015120000' });
        const normalized = normalizePlannerTabs([stored])[0];
        expect(normalized.resources[0].origin).not.toHaveProperty('workspaceName');
        expect(normalized.buildingBaseline).not.toHaveProperty('workspaceId');
        stored.resources[0].origin!.coreName = 'Mutated';
        stored.buildingBaseline!.counts.factory = 999;
        expect(normalized.resources[0].origin!.coreName).toBe('North');
        expect(normalized.buildingBaseline!.counts.factory).toBe(1);
        const legacy = { ...stored, resources: undefined, externalInputs: { ore: 60, bad: -1 } };
        expect(normalizePlannerTabs([legacy])[0].resources).toEqual([{ id: 'legacy-resource-1', itemId: 'ore', ratePerMinute: 60, enabled: true }]);
        expect(normalizePlannerTabs([{ ...legacy, resources: [] }])[0].resources).toEqual([]);
    });
});
