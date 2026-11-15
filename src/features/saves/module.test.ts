// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import type { SaveImportDecoder } from '@/platform/shared/save-import-effects';
import { archiveFixture } from '@/features/data-transfer/test-fixture';
import { analyzeSave } from './decoder/analyze';
import { SaveImportError } from './import-error';
import type { SaveSnapshot } from './snapshot';
import { saveGameData, snapshotFixture, extractionContext, saveFixture } from './decoder/test-fixture';
import type { SaveImportTelemetry } from './import-telemetry';
import { localStorageBytes, MAX_SAVE_WORKSPACES, MAX_WORKSPACE_BYTES } from './storage-schema';
import { createSaveWorkspace } from './workspace';

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => runtimes.splice(0).forEach(runtime => runtime.dispose()));

function setup(decodeSaveFile?: SaveImportDecoder) {
    const runtime = createAppRuntime();
    const imports = vi.fn<(telemetry: SaveImportTelemetry) => void>();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime, { effects: { decodeSaveFile, onSaveImport: imports } });
    const harness = createUkladTestHarness(runtime);
    // Includes active attached production, multi-output Planner tabs, linked buildings and energy groups.
    const state = archiveFixture();
    state.appDataVersion = 'update2_QoL';
    state.basesMode = 'planning';
    state.basesSelectedBaseId = 'target';
    state.basesSelectedDetailTab = 'plans';
    state.basesCardCollapsedSections = { target: { inputs: true } };
    state.productionPlanModalState = { ...state.productionPlanModalState, isOpen: true, baseId: 'target', editSectionId: 'production' };
    harness.restoreState(state);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
    return { runtime, harness, imports };
}

const pendingFile = () => ({ name: 'sample.sav', size: 20, arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) });
const unrelatedState = (state: ReturnType<ReturnType<typeof setup>['harness']['getState']>) => ({ ...state, savesImport: undefined, savesWorkspaces: undefined, savesWorkspaceOrder: undefined, savesActiveWorkspaceId: undefined, savesSelections: undefined });

it('opens the four curated demo Cores with their cargo, production, heat and power without changing plans', () => {
    const { harness } = setup();
    const initial = harness.getState();
    harness.dispatchSync([appIds.events.SAVES_OPEN_DEMO, 'Demo factory']);
    const workspace = harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])!;
    expect(workspace).toMatchObject({ name: 'Demo factory', isDemo: true });
    expect(workspace.snapshot.cores.map(core => ({ id: core.id, name: core.name, buildings: core.buildings.length }))).toEqual([
        { id: 803012, name: 'Helium Outpost', buildings: 4 },
        { id: 844256, name: 'Wolfram Foundry', buildings: 31 },
        { id: 869888, name: 'Titanium Works', buildings: 50 },
        { id: 891168, name: 'Calcium Refinery', buildings: 27 },
    ]);
    const map = harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, workspace.id])!;
    expect(map.entities).toHaveLength(116);
    expect(map.links).toEqual([
        { source: 884061, target: 870869, item: { id: 'calcite_sheets', name: 'Calcite Sheets' } },
        { source: 895568, target: 870818, item: { id: 'powder_calcium', name: 'Calcium Powder' } },
    ]);
    expect(map.coreLinks).toHaveLength(1);
    const overview = harness.getSubscriptionValue([appIds.subscriptions.SAVES_OVERVIEW, workspace.id])!;
    expect(overview.powerNetworks).toHaveLength(5);
    expect(overview.cores.every(core => core.heat !== null && core.heat > 0 && core.heatCapacity !== null)).toBe(true);
    expect(overview.buildingDetails.some(building => building.instance.configuration.kind === 'production')).toBe(true);
    expect(unrelatedState(harness.getState())).toEqual(unrelatedState(initial));
    harness.dispatchSync([appIds.events.SAVES_OPEN_DEMO, 'Another demo']);
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])).toEqual(workspace);
});

it.each(['storage', 'loading', 'catalog', 'import'] as const)('does not open a demo while %s is unavailable or busy', condition => {
    const { harness } = setup();
    if (condition === 'storage') harness.dispatchSync([appIds.events.SAVES_STORAGE_FAILED, 'load']);
    if (condition === 'loading') harness.restoreState({ ...harness.getState(), uiGameDataLoadPending: true });
    if (condition === 'catalog') harness.restoreState({ ...harness.getState(), savesBuildingCatalog: null });
    if (condition === 'import') harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    const before = harness.getState();
    harness.dispatchSync([appIds.events.SAVES_OPEN_DEMO, 'Demo factory']);
    expect(harness.getState()).toEqual(before);
});

it('reads compressed bytes with the selected state catalog and automatically opens independent Saves data', async () => {
    const { harness } = setup();
    const initial = harness.getState();
    const text = JSON.stringify(snapshotFixture());
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(text));
    const bytes = Uint8Array.from(Buffer.concat([header, deflateSync(text)])).buffer;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: bytes.byteLength, arrayBuffer: async () => bytes }]);
    await expect.poll(() => harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])).not.toBeNull();
    expect(harness.getState().savesImport.phase).toBe('closed');
    const candidate = { report: harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])!.snapshot };
    expect(candidate.report).toMatchObject({ gameData: { version: 'update2_QoL' }, cores: [{ id: 1 }, { id: 2 }] });
    const buildings = candidate.report.cores.flatMap(core => core.buildings);
    expect(buildings.find(building => building.id === 105)?.configuration).toEqual({ kind: 'extractor', itemId: 'ore_titanium', nodePurity: 'pure' });
    expect(buildings.find(building => building.id === 200)?.configuration).toEqual({ kind: 'production', recipeId: 'fabricator:9' });
    expect(buildings.find(building => building.id === 20)?.configuration).toEqual({ kind: 'dispatcher', itemId: 'helium', receiverId: 30 });
    expect(buildings.find(building => building.id === 21)?.configuration).toEqual({ kind: 'dispatcher', itemId: 'helium', receiverId: 31 });
    expect(unrelatedState(harness.getState())).toEqual(unrelatedState(initial));
    expect(PERSIST_KEYS.map(key => typeof key === 'string' ? key : key.key)).not.toContain(stateKeys.savesImport);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_CLOSE]);
    expect(harness.getState().savesImport.phase).toBe('closed');
    expect(unrelatedState(harness.getState())).toEqual(unrelatedState(initial));
});

it.each([
    ['update2_QoL', 'mappings'], ['earlyaccess', 'mapping-version'],
] as const)('reports unavailable mappings for %s before invoking the decoder', (appDataVersion, error) => {
    const decode = vi.fn<SaveImportDecoder>();
    const { harness, imports } = setup(decode);
    harness.restoreState({ ...harness.getState(), appDataVersion, savesBuildingCatalog: null, buildingsList: [], itemsList: [] });
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'select', error });
    expect(decode).not.toHaveBeenCalled();
    expect(imports).toHaveBeenCalledExactlyOnceWith({
        outcome: 'failure', error, stage: 'prepare', mode: 'new', dataVersion: appDataVersion, fileBytes: 20, durationMs: 0,
    });
});

it('finishes the original import despite close, reopen, and duplicate file requests', async () => {
    let finish!: (report: SaveSnapshot) => void;
    const decode = vi.fn<SaveImportDecoder>(() => new Promise(resolve => { finish = resolve; }));
    const { harness, imports } = setup(decode);
    const initial = unrelatedState(harness.getState());
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'original']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const reading = harness.getState().savesImport;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_CLOSE]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'other']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, { ...pendingFile(), name: 'other.sav' }]);
    expect(harness.getState().savesImport).toEqual(reading);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode.mock.calls[0][1].aborted).toBe(false);

    const report = analyzeSave(saveFixture(), extractionContext);
    finish(report);
    await expect.poll(() => harness.getState().savesImport.phase).toBe('closed');
    expect(harness.getState().savesWorkspaces.original.snapshot).toEqual(report);
    expect(unrelatedState(harness.getState())).toEqual(initial);
    expect(imports).toHaveBeenCalledOnce();
    expect(imports.mock.calls[0][0]).toMatchObject({ outcome: 'success', mode: 'new' });
});

it('rejects invalid files before invoking the decoder and preserves existing work on decode failure', async () => {
    const decode = vi.fn<SaveImportDecoder>(async () => { throw new SaveImportError('compression'); });
    const { harness, imports } = setup(decode);
    const initial = unrelatedState(harness.getState());
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, { ...pendingFile(), name: 'backup.json' }]);
    await expect.poll(() => harness.getState().savesImport.error).toBe('extension');
    expect(decode).not.toHaveBeenCalled();
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    await expect.poll(() => harness.getState().savesImport.error).toBe('compression');
    expect(unrelatedState(harness.getState())).toEqual(initial);
    expect(imports.mock.calls.map(([entry]) => [entry.outcome, 'error' in entry && entry.error])).toEqual([
        ['failure', 'extension'], ['failure', 'compression'],
    ]);
});

it('reports accepted new, updated and demo-replacement imports with aggregate measurements only', async () => {
    const report = analyzeSave(saveFixture(), extractionContext);
    const { harness, imports } = setup(async () => structuredClone(report));
    harness.dispatchSync([appIds.events.SAVES_OPEN_DEMO, 'Private demo name']);
    expect(imports).not.toHaveBeenCalled();
    for (const [id, mode] of [['first', 'new'], ['first', 'update'], ['demo-factory', 'replace-demo']] as const) {
        harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, id]);
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, { ...pendingFile(), name: 'Private player name.sav', size: 32_431_209 }]);
        const requestId = harness.getState().savesImport.requestId;
        await expect.poll(() => harness.getState().savesImport.phase).toBe('closed');
        const result = imports.mock.lastCall![0];
        expect(result).toEqual({
            outcome: 'success', mode, dataVersion: 'update2_QoL', dataRevision: report.gameData.revision,
            fileBytes: 32_431_209, durationMs: expect.any(Number), coreCount: 2, buildingCount: 2, powerNetworkCount: 3,
            workspaceBytes: localStorageBytes(harness.getState().savesWorkspaces[id]),
        });
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        const metrics = { dataVersion: 'update2_QoL', fileBytes: 32_431_209, durationMs: 10 } as const;
        // Repeated and contradictory completions of an accepted request must not be counted again.
        const count = imports.mock.calls.length;
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, requestId, report, metrics]);
        harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, requestId, 'read', undefined, metrics]);
        expect(imports).toHaveBeenCalledTimes(count);
    }
    expect(imports).toHaveBeenCalledTimes(3);
});

it('reports each failed attempt and a later successful retry, keeping exact limit diagnostics', async () => {
    const diagnostic = { subcode: 'building-name-chars', actual: 513, limit: 512 } as const;
    const report = analyzeSave(saveFixture(), extractionContext);
    const decode = vi.fn<SaveImportDecoder>().mockRejectedValueOnce(new SaveImportError('complexity', diagnostic))
        .mockResolvedValueOnce(report);
    const { harness, imports } = setup(decode);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const requestId = harness.getState().savesImport.requestId;
    await expect.poll(() => imports.mock.calls.length).toBe(1);
    expect(imports.mock.calls[0][0]).toEqual({
        outcome: 'failure', mode: 'new', dataVersion: 'update2_QoL', fileBytes: 20, durationMs: expect.any(Number),
        stage: 'decode', error: 'complexity', diagnostic,
    });
    const metrics = { dataVersion: 'update2_QoL', fileBytes: 20, durationMs: 10 } as const;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, requestId, 'complexity', diagnostic, metrics]);
    expect(imports).toHaveBeenCalledOnce();
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, requestId, 'read', undefined, metrics]);
    await expect.poll(() => imports.mock.calls.length).toBe(2);
    expect(imports.mock.calls[1][0]).toMatchObject({ outcome: 'success' });
});

it.each(['structure', 'save-storage-limit', 'workspace-limit', 'collection-bytes'] as const)(
    'does not count a decoded save as successful when workspace adoption fails: %s', async reason => {
        const report = analyzeSave(saveFixture(), extractionContext);
        if (reason === 'structure') report.gameData.revision = 'invalid';
        if (reason === 'save-storage-limit' || reason === 'collection-bytes') {
            // Valid unique buildings that exceed the workspace or combined collection budget.
            const count = reason === 'save-storage-limit' ? 5_000 : 1_500;
            const building = report.cores[0].buildings[0];
            report.cores[0].buildings = Array.from({ length: count }, (_, i) => ({ ...building, id: i + 1_000, name: 'x'.repeat(512) }));
        }
        const { harness, imports } = setup(async () => report);
        if (reason === 'workspace-limit') {
            const workspaces = Object.fromEntries(Array.from({ length: MAX_SAVE_WORKSPACES }, (_, i) =>
                [`save-${i}`, createSaveWorkspace(`save-${i}`, 'Existing', report)]));
            harness.restoreState({ ...harness.getState(), savesWorkspaces: workspaces });
        }
        if (reason === 'collection-bytes') {
            const workspace = createSaveWorkspace('existing', 'Existing', report);
            expect(localStorageBytes(workspace)).toBeLessThan(MAX_WORKSPACE_BYTES);
            harness.restoreState({ ...harness.getState(), savesWorkspaces: { existing: workspace } });
        }
        harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'new-save']);
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
        const error = reason === 'collection-bytes' ? 'workspace-limit' : reason;
        await expect.poll(() => harness.getState().savesImport.error).toBe(error);
        expect(imports).toHaveBeenCalledExactlyOnceWith({
            outcome: 'failure', mode: 'new', dataVersion: 'update2_QoL', fileBytes: 20, durationMs: expect.any(Number),
            stage: 'workspace', error,
        });
        expect(harness.getState().savesWorkspaces['new-save']).toBeUndefined();
    },
);

it.each(['catalog', 'removed', 'disposed'] as const)('does not report cancelled imports or late results after %s', async reason => {
    let finish!: (report: SaveSnapshot) => void;
    const decode = vi.fn<SaveImportDecoder>(() => new Promise(resolve => { finish = resolve; }));
    const { runtime, harness, imports } = setup(decode);
    if (reason === 'removed') harness.restoreState({ ...harness.getState(), savesWorkspaces: {
        cancelled: createSaveWorkspace('cancelled', 'Existing', analyzeSave(saveFixture(), extractionContext)),
    } });
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'cancelled']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    if (reason === 'catalog') harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update1', {
        ...structuredClone(saveGameData), saveBuildingCatalog: null,
    }]);
    if (reason === 'removed') harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'cancelled']);
    if (reason === 'disposed') runtime.dispose();
    expect(decode.mock.calls[0][1].aborted).toBe(true);
    finish(analyzeSave(saveFixture(), extractionContext));
    await new Promise(resolve => setImmediate(resolve));
    expect(imports).not.toHaveBeenCalled();
});

it('keeps limit diagnostics for the active import and clears them on retry, another failure and close', async () => {
    const diagnostic = { subcode: 'projection-chars', actual: 16_780_000, limit: 16_777_216 } as const;
    const decode = vi.fn<SaveImportDecoder>().mockRejectedValueOnce(new SaveImportError('complexity', diagnostic))
        .mockImplementation(() => new Promise(() => {}));
    const { harness } = setup(decode);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const first = harness.getState().savesImport.requestId;
    await expect.poll(() => harness.getSubscriptionValue([appIds.subscriptions.SAVES_IMPORT])).toMatchObject({
        phase: 'select', error: 'complexity', diagnostic,
    });
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'reading', error: null, diagnostic: null });
    const second = harness.getState().savesImport.requestId;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, first, 'complexity', diagnostic]);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'reading', error: null, diagnostic: null });
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, second, 'read']);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'select', error: 'read', diagnostic: null });
    harness.dispatchSync([appIds.events.SAVES_IMPORT_CLOSE]);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'closed', error: null, diagnostic: null });
});

it.each(['version', 'revision'] as const)('rejects a snapshot with an unsupported catalog %s', field => {
    const { harness } = setup(() => new Promise(() => {}));
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const report = analyzeSave(saveFixture(), extractionContext);
    report.gameData[field] = 'unsupported';
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, harness.getState().savesImport.requestId, report]);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'select', error: 'structure' });
});

it('replaces a workspace atomically, keeps its name, and clears the selection for removed or rebuilt Cores', () => {
    const { harness } = setup(() => new Promise(() => {}));
    const adopt = (id: string, snapshot: SaveSnapshot) => {
        harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, id]);
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, harness.getState().savesImport.requestId, snapshot]);
    };
    const initial = analyzeSave(saveFixture(), extractionContext);
    adopt('one', initial);
    adopt('two', initial);
    harness.dispatchSync([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Named world']);
    harness.dispatchSync([appIds.events.SAVES_SELECT_CORE, 'one', 2]);
    const updated = structuredClone(initial);
    updated.cores[0].buildings = [];
    updated.cores[1].spawnTimeSeconds = 999;
    adopt('one', updated);
    const workspace = harness.getState().savesWorkspaces.one;
    expect(workspace.name).toBe('Named world');
    expect(workspace.snapshot).toEqual(updated);
    expect(harness.getState().savesSelections.one.coreId).toBeNull();
    expect(harness.getState().savesWorkspaceOrder).toEqual(['one', 'two']);
    expect(harness.getState().savesWorkspaces.two.snapshot).toEqual(initial);
    updated.cores.shift();
    adopt('one', updated);
    const before = harness.getState().savesWorkspaces.one;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, harness.getState().savesImport.requestId, 'core-identity']);
    expect(harness.getState().savesWorkspaces.one).toEqual(before);
    expect(harness.getState().savesImport.error).toBe('core-identity');
});

it('preserves the previous snapshot on cancellation or invalid replacement and ignores a removed target', () => {
    const { harness } = setup(() => new Promise(() => {}));
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    const start = () => {
        harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'one']);
        harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
        return harness.getState().savesImport.requestId;
    };
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, start(), snapshot]);
    const before = harness.getState().savesWorkspaces.one;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_CLOSE]);
    expect(harness.getState().savesImport.phase).toBe('closed');
    expect(harness.getState().savesWorkspaces.one).toEqual(before);
    const invalid = structuredClone(snapshot);
    invalid.cores[0].spawnTimeSeconds = NaN;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, start(), invalid]);
    expect(harness.getState().savesWorkspaces.one).toEqual(before);
    expect(harness.getState().savesImport.error).toBe('structure');
    const removed = start();
    harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'one']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, removed, snapshot]);
    expect(harness.getState().savesWorkspaces).toEqual({});
});

it('passes the selected version and state catalogs to the decoder without a fixed version', async () => {
    const decode = vi.fn<SaveImportDecoder>(async request => ({
        ...analyzeSave(saveFixture(), extractionContext), gameData: { version: request.dataVersion, revision: saveGameData.saveBuildingCatalog.revision },
    }));
    const { harness } = setup(decode);
    const selected = structuredClone(saveGameData);
    selected.items.find(item => item.id === 'tube')!.name = 'Selected tube';
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update1', selected]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    await expect.poll(() => harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])).not.toBeNull();
    expect(decode.mock.calls[0][0]).toMatchObject({ dataVersion: 'update1', buildings: selected.buildings, items: selected.items });
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])!.snapshot.gameData.version).toBe('update1');
});

it('cancels a read on a catalog switch and ignores its completion even after switching back', async () => {
    const decode = vi.fn<SaveImportDecoder>(() => new Promise(() => {}));
    const { harness } = setup(decode);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const requestId = harness.getState().savesImport.requestId;
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update1', { ...structuredClone(saveGameData), saveBuildingCatalog: null }]);
    expect(decode.mock.calls[0][1].aborted).toBe(true);
    expect(harness.getState().savesImport.phase).toBe('closed');
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, requestId, analyzeSave(saveFixture(), extractionContext)]);
    expect(harness.getState().savesWorkspaces).toEqual({});
});
