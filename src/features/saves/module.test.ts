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

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => runtimes.splice(0).forEach(runtime => runtime.dispose()));

function setup(decodeSaveFile?: SaveImportDecoder) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime, { effects: { decodeSaveFile } });
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
    return { runtime, harness };
}

const pendingFile = () => ({ name: 'sample.sav', size: 20, arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) });
const unrelatedState = (state: ReturnType<ReturnType<typeof setup>['harness']['getState']>) => ({ ...state, savesImport: undefined, savesWorkspaces: undefined, savesWorkspaceOrder: undefined, savesActiveWorkspaceId: undefined, savesSelections: undefined });

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

it('reports unavailable mappings before invoking a decoder with an unloaded catalog', () => {
    const decode = vi.fn<SaveImportDecoder>();
    const { harness } = setup(decode);
    harness.restoreState({ ...harness.getState(), savesBuildingCatalog: null, buildingsList: [], itemsList: [] });
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    expect(harness.getState().savesImport).toMatchObject({ phase: 'select', error: 'mapping-version' });
    expect(decode).not.toHaveBeenCalled();
});

it('aborts superseded reads and ignores completion or failure after closing', async () => {
    const signals: AbortSignal[] = [];
    const completions: ((report: SaveSnapshot) => void)[] = [];
    const { harness } = setup((_request, signal) => {
        signals.push(signal);
        return new Promise(resolve => completions.push(resolve));
    });
    const initial = unrelatedState(harness.getState());
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const first = harness.getState().savesImport.requestId;
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    const second = harness.getState().savesImport.requestId;
    expect(signals[0].aborted).toBe(true);
    const report = analyzeSave(saveFixture(), extractionContext);
    completions[0](report);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, first, report]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, first, 'read']);
    await harness.flush();
    expect(harness.getState().savesImport.phase).toBe('reading');
    harness.dispatchSync([appIds.events.SAVES_IMPORT_CLOSE]);
    expect(signals[1].aborted).toBe(true);
    completions[1](report);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, second, report]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_FAILED, second, 'read']);
    await harness.flush();
    expect(harness.getState().savesImport).toMatchObject({ phase: 'closed', error: null });
    expect(unrelatedState(harness.getState())).toEqual(initial);
});

it('rejects invalid files before invoking the decoder and preserves existing work on decode failure', async () => {
    const decode = vi.fn<SaveImportDecoder>(async () => { throw new SaveImportError('compression'); });
    const { harness } = setup(decode);
    const initial = unrelatedState(harness.getState());
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, { ...pendingFile(), name: 'backup.json' }]);
    await expect.poll(() => harness.getState().savesImport.error).toBe('extension');
    expect(decode).not.toHaveBeenCalled();
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    await expect.poll(() => harness.getState().savesImport.error).toBe('compression');
    expect(unrelatedState(harness.getState())).toEqual(initial);
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

it('replaces a workspace atomically, keeps matching Core settings, and drops removed or rebuilt Cores', () => {
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
    for (const id of [1, 2]) harness.dispatchSync([appIds.events.SAVES_SET_CORE_OBJECTIVE, 'one', id, { kind: 'mission', name: 'Goal', itemIds: ['tube'] }]);
    harness.dispatchSync([appIds.events.SAVES_SELECT_CORE, 'one', 2]);
    const updated = structuredClone(initial);
    updated.cores[0].buildings = [];
    updated.cores[1].spawnTimeSeconds = 999;
    adopt('one', updated);
    const workspace = harness.getState().savesWorkspaces.one;
    expect(workspace.name).toBe('Named world');
    expect(workspace.snapshot).toEqual(updated);
    expect(Object.keys(workspace.coreSettings)).toEqual(['1:10.5']);
    expect(harness.getState().savesSelections.one.coreId).toBeNull();
    expect(harness.getState().savesWorkspaceOrder).toEqual(['one', 'two']);
    expect(harness.getState().savesWorkspaces.two.coreSettings).toEqual({});
    expect(harness.getState().savesWorkspaces.two.snapshot).toEqual(initial);
    updated.cores.shift();
    adopt('one', updated);
    expect(harness.getState().savesWorkspaces.one.coreSettings).toEqual({});
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
    const cancelled = start();
    harness.dispatchSync([appIds.events.SAVES_IMPORT_CLOSE]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, cancelled, { ...snapshot, cores: [] }]);
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

it('validates new objectives against the selected state catalogs', () => {
    const { harness } = setup(() => new Promise(() => {}));
    harness.dispatchSync([appIds.events.SAVES_IMPORT_OPEN, 'one']);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READ, pendingFile()]);
    harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, harness.getState().savesImport.requestId, analyzeSave(saveFixture(), extractionContext)]);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'earlyaccess', {
        buildings: [], items: [{ id: 'selected_item', name: 'Selected item', type: 'resource' }],
        corporations: { 'Selected corporation': { id: 'selected_corp', levels: [{ level: 7, components: [], rewards: [] }] } },
    }]);
    const select = (objective: import('./types').SaveCoreObjective) => harness.dispatchSync([appIds.events.SAVES_SET_CORE_OBJECTIVE, 'one', 1, objective]);
    const current = () => harness.getState().savesWorkspaces.one.coreSettings['1:10.5']?.objective;
    select({ kind: 'corporation', corporationId: 'selected_corp', level: 7 });
    expect(current()).toEqual({ kind: 'corporation', corporationId: 'selected_corp', level: 7 });
    select({ kind: 'corporation', corporationId: 'selected_corp', level: 2 });
    expect(current()).toMatchObject({ level: 7 });
    select({ kind: 'intermediate', itemIds: ['selected_item'] });
    expect(current()).toEqual({ kind: 'intermediate', itemIds: ['selected_item'] });
    select({ kind: 'intermediate', itemIds: ['tube'] });
    expect(current()).toEqual({ kind: 'intermediate', itemIds: ['selected_item'] });
});
