import { localStorageAdapter, memoryStorageAdapter, persist, type SyncPersistStorage } from '@ukladjs/persist';
import { createUkladHeadlessScenario, createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it } from 'vitest';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { saveGameData, extractionContext, snapshotFixture } from '@/features/saves/decoder/test-fixture';
import { MAX_WORKSPACE_BYTES } from '@/features/saves/storage-schema';
import { workspaceAtStorageBytes } from '@/features/saves/storage-test-fixture';
import { createSavesStorage, savesStorageKey } from './saves-storage';
import { PERSIST_KEYS } from './persistence';
import { createArchive, parseArchive } from '@/features/data-transfer/archive';

const owners: { scenario: ReturnType<typeof createUkladHeadlessScenario<import('@/app/uklad/contracts').AppContracts>>; persistence: ReturnType<typeof persist> }[] = [];
afterEach(async () => {
    for (const owner of owners.splice(0)) { owner.persistence.dispose(); await owner.scenario.dispose(); }
    localStorage.clear();
});
const prefix = 'saves-persistence-test';
const key = (root: string) => root.startsWith('saves') ? savesStorageKey(prefix, root) : `${prefix}/${root}`;

async function setup(storage: SyncPersistStorage = memoryStorageAdapter()) {
    const runtime = createAppRuntime();
    registerHeadlessApplication(runtime, { effects: { decodeSaveFile: () => new Promise(() => {}) } });
    const savesStorage = createSavesStorage(storage, prefix);
    const persistence = persist(runtime, { storage: savesStorage.storage, keys: PERSIST_KEYS, prefix,
        onError: ({ phase }) => runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, phase === 'write' || phase === 'serialize' ? 'write' : 'load']),
    });
    const scenario = createUkladHeadlessScenario(runtime);
    owners.push({ scenario, persistence });
    const view = scenario.mountView('Saved workspaces', {
        tabs: [appIds.subscriptions.SAVES_TABS], active: [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE],
        one: [appIds.subscriptions.SAVES_WORKSPACE_BY_ID, 'one'], selection: [appIds.subscriptions.SAVES_SELECTED_CORE, 'one'],
        persistence: [appIds.subscriptions.SAVES_STORAGE_ERROR], candidate: [appIds.subscriptions.SAVES_IMPORT],
    } as const);
    persistence.hydrate();
    scenario.dispatch([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
    if (savesStorage.hasLoadError()) runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'load']);
    await scenario.settle();
    const dispatch = async (event: Parameters<typeof scenario.dispatch>[0]) => { scenario.dispatch(event); await scenario.settle(); };
    const adopt = async (id = 'one') => {
        await dispatch([appIds.events.SAVES_IMPORT_OPEN, id]);
        await dispatch([appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }]);
        await dispatch([appIds.events.SAVES_IMPORT_READY, view.value('candidate').requestId, analyzeSave(snapshotFixture(), extractionContext)]);
        await dispatch([appIds.events.SAVES_RENAME_WORKSPACE, id, id]);
    };
    return { scenario, persistence, view, dispatch, adopt, harness: createUkladTestHarness(runtime) };
}

it('round-trips Saves through the standard localStorage adapter alongside existing settings', async () => {
    const storage = localStorageAdapter();
    const theme = JSON.stringify({ v: 1, data: 'dark' });
    localStorage.setItem(key(stateKeys.uiTheme), theme);
    const app = await setup(storage);
    await app.adopt();
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'My world']);
    await app.dispatch([appIds.events.SAVES_SELECT_CORE, 'one', 1]);
    await app.adopt('two');
    await app.dispatch([appIds.events.SAVES_SELECT_CORE, 'two', 2]);
    await app.dispatch([appIds.events.SAVES_SELECT_WORKSPACE, 'one']);
    expect(app.view.value('persistence')).toBeNull();
    const data = JSON.parse(localStorage.getItem(key(stateKeys.savesWorkspaces))!).data;
    expect(Object.keys(data.one).sort()).toEqual(['id', 'name', 'schemaVersion', 'snapshot']);
    expect(data.one.name).toBe('My world');
    expect(data.one.snapshot).not.toHaveProperty('catalog');
    expect(data.one.snapshot).not.toHaveProperty('compressedBytes');
    expect(localStorage.getItem(key(stateKeys.savesImport))).toBeNull();
    expect(localStorage.getItem(key(stateKeys.uiTheme))).toBe(theme);
    const expected = app.view.value('active');
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.view.value('active')).toEqual(expected);
    expect(restored.view.value('selection')?.core.id).toBe(1);
    expect(restored.view.value('selection')?.core.bounds).toEqual({ min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } });
    expect(restored.view.value('candidate').phase).toBe('closed');
    await restored.dispatch([appIds.events.SAVES_REMOVE_WORKSPACE, 'one']);
    restored.persistence.dispose();
    const reopened = await setup(storage);
    expect(reopened.view.value('tabs')).toEqual([{ id: 'two', name: 'two' }]);
    expect(reopened.view.value('active')?.id).toBe('two');
});

it('persists map preferences but resets selected nodes and the camera for a new session', async () => {
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.adopt();
    const display = { buildingSize: 88, showNames: true, showResources: false, showGrid: false, animateCargo: false };
    const layers = { showLinks: false, showBounds: false, showPowerNetworks: true };
    await app.dispatch([appIds.events.SAVES_SET_MAP_DISPLAY, display]);
    await app.dispatch([appIds.events.SAVES_SET_MAP_LAYERS, layers]);
    await app.dispatch([appIds.events.SAVES_SELECT_MAP_NODE, 'one', 20]);
    await app.dispatch([appIds.events.SAVES_SET_MAP_VIEWPORT, 'one', 100, 200, 0.5]);
    expect(app.harness.getState().savesMapSelectedNodes.one).toBe(20);
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.harness.getState().savesMapDisplay).toEqual(display);
    expect(restored.harness.getState().savesMapLayers).toEqual(layers);
    expect(restored.harness.getState().savesMapSelectedNodes).toEqual({});
    expect(restored.harness.getState().savesMapViewports).toEqual({});
});

it('persists independent planner allocations while comparison selection stays in the runtime', async () => {
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.adopt();
    await app.dispatch([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Plan', 'single']);
    await app.dispatch([appIds.events.PLANNER_SET_SELECTED_ITEM, 'bar_titanium']);
    const picker = app.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_PICKER, 'one'])!;
    const core = picker.cores.find(core => core.buildings.length)!;
    await app.dispatch([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'one', picker.snapshotKey, [{ buildingId: core.buildings[0].buildingId, ratePerMinute: 25 }]]);
    const original = structuredClone(app.harness.getState().plannerTabs);
    await app.dispatch([appIds.events.PLANNER_SET_COMPARISON_CORES, 'one', picker.snapshotKey, [core.coreId]]);
    expect(app.harness.getState().plannerComparisonCoreIds).toEqual([core.coreId]);
    const persisted = JSON.parse(storage.getItem(key(stateKeys.plannerTabs))!).data;
    expect(persisted).toEqual(original);
    expect(persisted[0]).not.toHaveProperty('buildingBaseline');
    expect(Object.keys(persisted[0].resources[0]).sort()).toEqual(['coreId', 'coreName', 'enabled', 'id', 'itemId', 'ratePerMinute']);
    expect(storage.getItem(key(stateKeys.plannerComparisonCoreIds))).toBeNull();
    const archive = createArchive(app.harness.getState(), { baseIds: [], planIds: null });
    expect(parseArchive(JSON.stringify(archive)).plans).toEqual(original);
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.harness.getState().plannerTabs).toEqual(original);
    expect(restored.harness.getState().plannerComparisonCoreIds).toEqual([]);
    expect(restored.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON])).toEqual({ coreNames: [], rows: [] });
    await restored.dispatch([appIds.events.SAVES_REMOVE_WORKSPACE, 'one']);
    expect(restored.harness.getState().plannerTabs).toEqual(original);
});

it('normalizes partial or invalid stored map preferences without failing save hydration', async () => {
    localStorage.setItem(`${prefix}/${stateKeys.savesMapDisplay}`, JSON.stringify({ v: 1, data: {
        buildingSize: -5, showNames: true, showGrid: 'false', animateCargo: false,
    } }));
    localStorage.setItem(`${prefix}/${stateKeys.savesMapLayers}`, JSON.stringify({ v: 1, data: { showLinks: false, showBounds: null } }));
    const app = await setup(localStorageAdapter());
    expect(app.harness.getState().savesMapDisplay).toEqual({ buildingSize: 72, showNames: true, showResources: true, showGrid: true, animateCargo: false });
    expect(app.harness.getState().savesMapLayers).toEqual({ showLinks: false, showBounds: true, showPowerNetworks: false });
    expect(app.view.value('persistence')).toBeNull();
});

it('rejects incomplete workspaces without rewriting stored data', async () => {
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.adopt();
    app.persistence.dispose();
    await app.scenario.dispose();
    const envelope = JSON.parse(storage.getItem(key(stateKeys.savesWorkspaces))!);
    for (const core of envelope.data.one.snapshot.cores) delete core.bounds;
    const legacy = JSON.stringify(envelope);
    storage.setItem(key(stateKeys.savesWorkspaces), legacy);
    const restored = await setup(storage);
    expect(restored.view.value('persistence')).toBe('load');
    expect(restored.view.value('one')).toBeNull();
    expect(storage.getItem(key(stateKeys.savesWorkspaces))).toBe(legacy);
});

it('commits consecutive edits synchronously without a storage queue or flush barrier', async () => {
    const memory = memoryStorageAdapter();
    const app = await setup(memory);
    await app.adopt();
    app.harness.dispatchSync([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'First edit']);
    expect(JSON.parse(memory.getItem(key(stateKeys.savesWorkspaces))!).data.one.name).toBe('First edit');
    await app.scenario.settle();
    app.harness.dispatchSync([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Latest edit']);
    expect(JSON.parse(memory.getItem(key(stateKeys.savesWorkspaces))!).data.one.name).toBe('Latest edit');
    await app.scenario.settle();
    expect(app.view.value('persistence')).toBeNull();
});

it('reports quota failure without losing committed data, and persists subsequent edits', async () => {
    const memory = memoryStorageAdapter();
    let failing = false;
    const storage: SyncPersistStorage = {
        sync: true,
        getItem: key => memory.getItem(key), removeItem: key => memory.removeItem(key),
        setItem: (storageKey, value) => {
            if (failing && storageKey === key(stateKeys.savesWorkspaces)) throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
            memory.setItem(storageKey, value);
        },
    };
    const app = await setup(storage);
    await app.adopt();
    const original = memory.getItem(key(stateKeys.savesWorkspaces));
    failing = true;
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'New name']);
    expect(app.view.value('persistence')).toBe('write');
    expect(memory.getItem(key(stateKeys.savesWorkspaces))).toBe(original);
    await app.dispatch([appIds.events.SAVES_SELECT_CORE, 'one', 1]);
    expect(app.view.value('persistence')).toBe('write');
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Newest name']);
    expect(app.view.value('persistence')).toBe('write');
    failing = false;
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Recovered name']);
    expect(JSON.parse(memory.getItem(key(stateKeys.savesWorkspaces))!).data.one.name).toBe('Recovered name');
});

it('keeps corrupt stored schemas untouched and blocks edits instead of replacing them with empty workspaces', async () => {
    const memory = memoryStorageAdapter();
    const corrupt = JSON.stringify({ v: 1, data: { one: { schemaVersion: 99 } } });
    memory.setItem(key(stateKeys.savesWorkspaces), corrupt);
    const app = await setup(memory);
    expect(app.view.value('persistence')).toBe('load');
    await app.adopt();
    expect(app.view.value('tabs')).toEqual([]);
    expect(memory.getItem(key(stateKeys.savesWorkspaces))).toBe(corrupt);
});

it('keeps the last stored snapshot when an edit exceeds its budget and recovers after reducing the data', async () => {
    const memory = memoryStorageAdapter();
    const original = JSON.stringify({ v: 1, data: { one: workspaceAtStorageBytes(MAX_WORKSPACE_BYTES - 40) } });
    memory.setItem(key(stateKeys.savesWorkspaces), original);
    const app = await setup(memory);
    expect(app.view.value('persistence')).toBeNull();
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'x'.repeat(120)]);
    expect(app.view.value('persistence')).toBe('write');
    expect(memory.getItem(key(stateKeys.savesWorkspaces))).toBe(original);
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'one']);
    expect(JSON.parse(memory.getItem(key(stateKeys.savesWorkspaces))!).data.one.name).toBe('one');
});

it('starts fresh instead of migrating experimental schemas', async () => {
    const memory = memoryStorageAdapter();
    memory.setItem(`${prefix}/saves-v4/${stateKeys.savesWorkspaces}`, JSON.stringify({ v: 1, data: { old: { schemaVersion: 4 } } }));
    memory.setItem(`${prefix}/saves-v4/${stateKeys.savesWorkspaceOrder}`, JSON.stringify({ v: 1, data: ['old'] }));
    const app = await setup(memory);
    expect(app.view.value('persistence')).toBeNull();
    expect(app.view.value('tabs')).toEqual([]);
    await app.adopt();
    expect(app.view.value('tabs')).toEqual([{ id: 'one', name: 'one' }]);
    expect(JSON.parse(memory.getItem(key(stateKeys.savesWorkspaces))!).data.one.schemaVersion).toBe(1);
});
