import { localStorageAdapter, memoryStorageAdapter, persist, type SyncPersistStorage } from '@ukladjs/persist';
import { createUkladHeadlessScenario, createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import * as fflate from 'fflate';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { saveGameData, extractionContext, snapshotFixture, storageFixture } from '@/features/saves/decoder/test-fixture';
import { deserializeSaveWorkspaces, MAX_SAVES_BYTES, saveCollectionStorageBytes } from '@/features/saves/storage-schema';
import { workspaceAtStorageBytes, workspaceWithUnicodeNames } from '@/features/saves/storage-test-fixture';
import { encodeSaveWorkspaces } from '@/features/saves/storage-codec';
import { createSaveWorkspace } from '@/features/saves/workspace';
import type { SaveImportTelemetry } from '@/features/saves/import-telemetry';
import { createSavesStorage, savesStorageKey } from './saves-storage';
import { createArchive, parseArchive } from '@/features/data-transfer/archive';

vi.mock('fflate', async importOriginal => {
    const actual = await importOriginal<typeof import('fflate')>();
    return { ...actual, gzipSync: vi.fn(actual.gzipSync), gunzipSync: vi.fn(actual.gunzipSync) };
});

const owners: { scenario: ReturnType<typeof createUkladHeadlessScenario<import('@/app/uklad/contracts').AppContracts>>; persistence: ReturnType<typeof persist> }[] = [];
afterEach(async () => {
    for (const owner of owners.splice(0)) { owner.persistence.dispose(); await owner.scenario.dispose(); }
    localStorage.clear();
    vi.clearAllMocks();
});
const prefix = 'saves-persistence-test';
const key = (root: string) => root.startsWith('saves') ? savesStorageKey(prefix, root) : `${prefix}/${root}`;
const readWorkspaces = (storage: SyncPersistStorage) => deserializeSaveWorkspaces(JSON.parse(storage.getItem(key(stateKeys.savesWorkspaces))!).data);

async function setup(storage: SyncPersistStorage = memoryStorageAdapter()) {
    const runtime = createAppRuntime();
    const imports = vi.fn<(telemetry: SaveImportTelemetry) => void>();
    registerHeadlessApplication(runtime, { effects: { decodeSaveFile: () => new Promise(() => {}), onSaveImport: imports } });
    const savesStorage = createSavesStorage(storage, prefix);
    const persistence = persist(runtime, { storage: savesStorage.storage, keys: savesStorage.keys, prefix,
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
    return { scenario, persistence, view, dispatch, adopt, imports, harness: createUkladTestHarness(runtime) };
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
    const raw = localStorage.getItem(key(stateKeys.savesWorkspaces))!;
    expect(JSON.parse(raw).data).toMatchObject({ encoding: 'gzip-base64', version: 1, payload: expect.any(String) });
    expect(raw.length * 2).toBe(saveCollectionStorageBytes(app.harness.getState().savesWorkspaces));
    const data = readWorkspaces(storage);
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
    expect(restored.harness.getState().savesWorkspaces).toStrictEqual(data);
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

it('keeps sample data labeled as a demo after reloading the browser', async () => {
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.dispatch([appIds.events.SAVES_OPEN_DEMO, 'Demo factory']);
    const demo = app.view.value('active');
    expect(demo?.isDemo).toBe(true);
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.view.value('active')).toEqual(demo);
    expect(restored.view.value('persistence')).toBeNull();
});

it('loads legacy JSON without rewriting it and upgrades on the next edit while preserving every snapshot', async () => {
    const storage = memoryStorageAdapter();
    const workspaces = {
        one: createSaveWorkspace('one', '工場 🏭', analyzeSave(snapshotFixture(), extractionContext)),
        two: createSaveWorkspace('two', 'Inventory', analyzeSave(storageFixture(), extractionContext)),
    };
    const original = JSON.stringify({ v: 1, data: workspaces });
    storage.setItem(key(stateKeys.savesWorkspaces), original);
    storage.setItem(key(stateKeys.savesWorkspaceOrder), JSON.stringify({ v: 1, data: ['two', 'one'] }));
    storage.setItem(key(stateKeys.savesActiveWorkspaceId), JSON.stringify({ v: 1, data: 'one' }));
    storage.setItem(key(stateKeys.savesSelections), JSON.stringify({ v: 1, data: { one: { coreId: 1 } } }));
    const app = await setup(storage);
    expect(app.view.value('persistence')).toBeNull();
    expect(app.harness.getState().savesWorkspaces).toStrictEqual(workspaces);
    expect(storage.getItem(key(stateKeys.savesWorkspaces))).toBe(original);
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Updated 🏭']);
    const raw = storage.getItem(key(stateKeys.savesWorkspaces))!;
    expect(JSON.parse(raw).data.encoding).toBe('gzip-base64');
    expect(raw.length * 2).toBe(saveCollectionStorageBytes(app.harness.getState().savesWorkspaces));
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.harness.getState().savesWorkspaces).toStrictEqual({ ...workspaces, one: { ...workspaces.one, name: 'Updated 🏭' } });
    expect(restored.harness.getState().savesWorkspaceOrder).toEqual(['two', 'one']);
    expect(restored.view.value('active')?.id).toBe('one');
    expect(restored.view.value('selection')?.core.id).toBe(1);
});

it('keeps a legacy Unicode-heavy save loadable and editable when compression expands it', async () => {
    const storage = localStorageAdapter();
    const workspaces = { one: workspaceWithUnicodeNames() };
    const original = JSON.stringify({ v: 1, data: workspaces });
    storage.setItem(key(stateKeys.savesWorkspaces), original);
    const app = await setup(storage);
    expect(app.view.value('persistence')).toBeNull();
    expect(app.harness.getState().savesWorkspaces).toStrictEqual(workspaces);
    expect(storage.getItem(key(stateKeys.savesWorkspaces))).toBe(original);
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Renamed 工場']);
    const expected = { one: { ...workspaces.one, name: 'Renamed 工場' } };
    const raw = storage.getItem(key(stateKeys.savesWorkspaces))!;
    expect(JSON.parse(raw).data).toStrictEqual(expected);
    expect(raw.length * 2).toBe(saveCollectionStorageBytes(expected));
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.view.value('persistence')).toBeNull();
    expect(restored.harness.getState().savesWorkspaces).toStrictEqual(expected);
});

it('decompresses and validates a large collection once without recompressing during hydration', async () => {
    const template = workspaceAtStorageBytes(8 * 1024 * 1024);
    const workspaces = Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
        const id = `save-${index}`;
        return [id, { ...template, id }];
    }));
    const raw = JSON.stringify({ v: 1, data: encodeSaveWorkspaces(workspaces) });
    const storage = memoryStorageAdapter({ [key(stateKeys.savesWorkspaces)]: raw });
    const gunzip = vi.mocked(fflate.gunzipSync).mockClear(), gzip = vi.mocked(fflate.gzipSync).mockClear();
    const app = await setup(storage);
    expect(app.view.value('persistence')).toBeNull();
    expect({ decompress: gunzip.mock.calls.length, compress: gzip.mock.calls.length }).toEqual({ decompress: 1, compress: 0 });
    expect(app.harness.getState().savesWorkspaces).toStrictEqual(workspaces);
    expect(storage.getItem(key(stateKeys.savesWorkspaces))).toBe(raw);
}, 15_000);

it.each([1, 8])('reuses import preparation for telemetry and immediate persistence with %i workspaces', async count => {
    const template = workspaceAtStorageBytes(8 * 1024 * 1024);
    const workspaces = count === 1 ? {} : Object.fromEntries(Array.from({ length: count }, (_, index) => {
        const id = index ? `save-${index}` : 'one';
        return [id, { ...template, id }];
    }));
    const storage = memoryStorageAdapter({ [key(stateKeys.savesWorkspaces)]: JSON.stringify({ v: 1, data: encodeSaveWorkspaces(workspaces) }) });
    const app = await setup(storage);
    const unchanged = app.harness.getState().savesWorkspaces['save-1'];
    await app.dispatch([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    await app.dispatch([appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: 10, arrayBuffer: () => new Promise(() => {}) }]);
    const snapshot = structuredClone(template.snapshot);
    snapshot.cores[0].name = 'Updated factory';
    const gzip = vi.mocked(fflate.gzipSync).mockClear();
    app.harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, app.view.value('candidate').requestId, snapshot,
        { dataVersion: 'update2_QoL', fileBytes: 10, durationMs: 1 }]);
    // The standalone workspace is encoded once; only a larger collection needs another encoding.
    expect(gzip).toHaveBeenCalledTimes(count === 1 ? 1 : 2);
    expect(app.harness.getState().savesImport.phase).toBe('closed');
    expect(app.imports).toHaveBeenCalledOnce();
    expect(app.imports.mock.calls[0][0]).toMatchObject({ outcome: 'success', workspaceBytes: expect.any(Number) });
    const committed = app.harness.getState().savesWorkspaces;
    expect(readWorkspaces(storage)).toStrictEqual(committed);
    expect(committed.one.snapshot).toStrictEqual(snapshot);
    expect(committed['save-1']).toBe(unchanged);
    expect(committed.one).not.toHaveProperty('storage');
    await app.scenario.settle();

    // A subsequent edit must encode its new root, never replay the import's prepared value.
    gzip.mockClear();
    app.harness.dispatchSync([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Renamed after import']);
    expect(gzip).toHaveBeenCalledOnce();
    expect(readWorkspaces(storage).one.name).toBe('Renamed after import');
    await app.scenario.settle();
}, 15_000);

it('reuses a prepared plain representation when a Unicode-heavy import expands under compression', async () => {
    const snapshot = workspaceWithUnicodeNames().snapshot;
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.dispatch([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    await app.dispatch([appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: 10, arrayBuffer: () => new Promise(() => {}) }]);
    const gzip = vi.mocked(fflate.gzipSync).mockClear();
    app.harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, app.view.value('candidate').requestId, snapshot,
        { dataVersion: 'update2_QoL', fileBytes: 10, durationMs: 1 }]);
    expect(gzip).toHaveBeenCalledOnce();
    const raw = storage.getItem(key(stateKeys.savesWorkspaces))!;
    expect(JSON.parse(raw).data).toStrictEqual(app.harness.getState().savesWorkspaces);
    expect(readWorkspaces(storage).one.snapshot).toStrictEqual(snapshot);
    expect(app.imports.mock.calls[0][0]).toMatchObject({ outcome: 'success', workspaceBytes: raw.length * 2 });
    await app.scenario.settle();
});

it('keeps a pre-inventory factory usable and captures its inventory on the next import', async () => {
    const snapshot = analyzeSave(storageFixture(), extractionContext);
    const legacy = structuredClone(snapshot);
    for (const building of legacy.cores.flatMap(core => core.buildings)) {
        if (building.configuration.kind === 'storage') building.configuration = { kind: 'other' };
    }
    const storage = memoryStorageAdapter();
    storage.setItem(key(stateKeys.savesWorkspaces), JSON.stringify({ v: 1, data: {
        one: { schemaVersion: 1, id: 'one', name: 'Old factory', snapshot: legacy },
    } }));
    const app = await setup(storage);
    expect(app.view.value('persistence')).toBeNull();
    expect(app.harness.getSubscriptionValue([appIds.subscriptions.SAVES_STORAGE_GROUPS, 'one'])).toBeNull();
    const picker = app.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE, 'one']);
    expect(picker?.compatible).toBe(true);
    await app.dispatch([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    await app.dispatch([appIds.events.SAVES_IMPORT_READ, { name: 'world.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }]);
    await app.dispatch([appIds.events.SAVES_IMPORT_READY, app.view.value('candidate').requestId, snapshot]);
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.view.value('active')?.name).toBe('Old factory');
    expect(restored.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE, 'one'])?.snapshotKey).toBe(picker?.snapshotKey);
    const restoredGroups = restored.harness.getSubscriptionValue([appIds.subscriptions.SAVES_STORAGE_GROUPS, 'one']);
    expect(restoredGroups?.map(group => group.total)).toEqual([53, 107, 0, 2]);
    expect(restoredGroups?.[0].items.find(item => item.id === 'helium')?.availability?.capacity).toBe(300);
});

it('persists independent planner allocations while comparison selection stays in the runtime', async () => {
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.adopt();
    await app.dispatch([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Plan', 'single']);
    await app.dispatch([appIds.events.PLANNER_SET_SELECTED_ITEM, 'bar_titanium']);
    const picker = app.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCE_PICKER, 'one'])!;
    const core = picker.groups.find(core => core.buildings.length)!;
    await app.dispatch([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'one', picker.snapshotKey, [{ buildingId: core.buildings[0].buildingId, ratePerMinute: 25 }]]);
    const original = structuredClone(app.harness.getState().plannerTabs);
    await app.dispatch([appIds.events.PLANNER_SET_COMPARISON_CORES, 'one', picker.snapshotKey, [core.coreId]]);
    expect(app.harness.getState().plannerComparisonCoreIds).toEqual([core.coreId]);
    const persisted = JSON.parse(storage.getItem(key(stateKeys.plannerTabs))!).data;
    expect(persisted).toEqual(original);
    expect(persisted[0]).not.toHaveProperty('buildingBaseline');
    expect(Object.keys(persisted[0].resources[0]).sort()).toEqual(['coreId', 'coreIds', 'coreName', 'enabled', 'id', 'itemId', 'ratePerMinute', 'source']);
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
    const envelope = { v: 1, data: readWorkspaces(storage) };
    for (const core of envelope.data.one.snapshot.cores) Reflect.deleteProperty(core, 'bounds');
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
    expect(readWorkspaces(memory).one.name).toBe('First edit');
    await app.scenario.settle();
    app.harness.dispatchSync([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Latest edit']);
    expect(readWorkspaces(memory).one.name).toBe('Latest edit');
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
    const updated = analyzeSave(snapshotFixture(), extractionContext);
    updated.cores[0].name = 'Updated despite quota failure';
    await app.dispatch([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    await app.dispatch([appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: 10, arrayBuffer: () => new Promise(() => {}) }]);
    const gzip = vi.mocked(fflate.gzipSync).mockClear();
    await app.dispatch([appIds.events.SAVES_IMPORT_READY, app.view.value('candidate').requestId, updated]);
    expect(gzip).toHaveBeenCalledOnce();
    expect(app.view.value('persistence')).toBe('write');
    expect(memory.getItem(key(stateKeys.savesWorkspaces))).toBe(original);
    await app.dispatch([appIds.events.SAVES_SELECT_CORE, 'one', 1]);
    expect(app.view.value('persistence')).toBe('write');
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Newest name']);
    expect(app.view.value('persistence')).toBe('write');
    failing = false;
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Recovered name']);
    expect(readWorkspaces(memory).one.name).toBe('Recovered name');
    expect(readWorkspaces(memory).one.snapshot).toStrictEqual(updated);
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

it('retains a validated collection when later Saves metadata fails without blocking unrelated persistence', async () => {
    const workspace = createSaveWorkspace('one', 'Stored world', analyzeSave(snapshotFixture(), extractionContext));
    const raw = JSON.stringify({ v: 1, data: encodeSaveWorkspaces({ one: workspace }) });
    const badOrder = JSON.stringify({ v: 1, data: [123] });
    const storage = memoryStorageAdapter({
        [key(stateKeys.savesWorkspaces)]: raw,
        [key(stateKeys.savesWorkspaceOrder)]: badOrder,
    });
    const app = await setup(storage);
    expect(app.view.value('persistence')).toBe('load');
    expect(app.view.value('one')).toStrictEqual(workspace);
    await app.dispatch([appIds.events.UI_SET_LOCALE, 'de']);
    expect(JSON.parse(storage.getItem(key(stateKeys.uiLocale))!).data).toBe('de');
    expect(storage.getItem(key(stateKeys.savesWorkspaces))).toBe(raw);
    expect(storage.getItem(key(stateKeys.savesWorkspaceOrder))).toBe(badOrder);
});

it('preserves corrupt compressed storage and unrelated settings instead of overwriting the save', async () => {
    const storage = memoryStorageAdapter();
    const app = await setup(storage);
    await app.adopt();
    app.persistence.dispose();
    await app.scenario.dispose();
    const envelope = JSON.parse(storage.getItem(key(stateKeys.savesWorkspaces))!);
    const bytes = Uint8Array.from(atob(envelope.data.payload), char => char.charCodeAt(0));
    bytes[bytes.length - 8] ^= 1;
    envelope.data.payload = btoa(String.fromCharCode(...bytes));
    const corrupt = JSON.stringify(envelope);
    storage.setItem(key(stateKeys.savesWorkspaces), corrupt);
    storage.setItem(key(stateKeys.uiTheme), JSON.stringify({ v: 1, data: 'dark' }));
    const restored = await setup(storage);
    expect(restored.view.value('persistence')).toBe('load');
    expect(restored.harness.getState().uiTheme).toBe('dark');
    await restored.adopt();
    expect(restored.view.value('tabs')).toEqual([]);
    expect(storage.getItem(key(stateKeys.savesWorkspaces))).toBe(corrupt);
});

it('persists and reloads snapshots above the old uncompressed 3 MiB limit', async () => {
    const storage = localStorageAdapter();
    const expected = workspaceAtStorageBytes(MAX_SAVES_BYTES + 1024 * 1024);
    const original = JSON.stringify({ v: 1, data: encodeSaveWorkspaces({ one: expected }) });
    storage.setItem(key(stateKeys.savesWorkspaces), original);
    const app = await setup(storage);
    expect(app.view.value('persistence')).toBeNull();
    expect(app.view.value('one')?.name).toBe('one');
    await app.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Large factory']);
    expect(app.view.value('persistence')).toBeNull();
    expect(storage.getItem(key(stateKeys.savesWorkspaces))!.length * 2).toBeLessThan(MAX_SAVES_BYTES);
    expect(readWorkspaces(storage).one.snapshot).toStrictEqual(expected.snapshot);
    app.persistence.dispose();
    await app.scenario.dispose();
    const restored = await setup(storage);
    expect(restored.view.value('persistence')).toBeNull();
    expect(restored.view.value('one')).toStrictEqual({ ...expected, name: 'Large factory' });
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
    expect(readWorkspaces(memory).one.schemaVersion).toBe(1);
});
