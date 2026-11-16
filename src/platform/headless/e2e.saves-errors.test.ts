// @vitest-environment node

import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { extractionContext, saveFixture, saveGameData, snapshotFixture } from '@/features/saves/decoder/test-fixture';
import type { SaveImportTelemetry } from '@/features/saves/import-telemetry';
import { workspaceWithRandomNames } from '@/features/saves/storage-test-fixture';
import { createHeadlessE2EApp, type HeadlessE2EApp } from './e2e-support';

const E = appIds.events;
const S = appIds.subscriptions;
const file = { name: 'factory.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) };
const metrics = { dataVersion: 'update2_QoL' as const, fileBytes: 10, durationMs: 5 };

describe('headless save import recovery E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = (options: Parameters<typeof createHeadlessE2EApp>[0] = {}) => {
        const app = createHeadlessE2EApp(options);
        apps.push(app);
        return app;
    };
    afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.dispose())); });

    const controlledImport = async (onSaveImport?: (event: SaveImportTelemetry) => void) => {
        const app = createApp({ application: { effects: { decodeSaveFile: () => new Promise(() => {}), onSaveImport } } });
        await app.seed('update2_QoL', structuredClone(saveGameData));
        const view = app.mountView('save import and map', {
            candidate: [S.SAVES_IMPORT], active: [S.SAVES_ACTIVE_WORKSPACE], workspaces: [S.SAVES_WORKSPACES],
            selections: [S.SAVES_SELECTIONS], nodes: [S.SAVES_MAP_SELECTED_NODES], filters: [S.SAVES_MAP_BUILDING_FILTERS],
            viewports: [S.SAVES_MAP_VIEWPORTS], storage: [S.SAVES_STORAGE_ERROR],
        } as const);
        const start = async (id: string) => {
            await app.dispatch([E.SAVES_IMPORT_OPEN, id]);
            await app.dispatch([E.SAVES_IMPORT_READ, file]);
            return view.value('candidate').requestId;
        };
        const accept = async (id: string, snapshot = analyzeSave(snapshotFixture(), extractionContext)) => {
            const request = await start(id);
            await app.dispatch([E.SAVES_IMPORT_READY, request, snapshot, metrics]);
        };
        return { app, view, start, accept };
    };

    it('retains a selected Core across reimports and clears it when that Core disappears', async () => {
        const telemetry: SaveImportTelemetry[] = [];
        const { app, view, accept } = await controlledImport(event => telemetry.push(event));
        await accept('one');
        await app.dispatch([E.SAVES_SELECT_CORE, 'one', 1]);
        await app.dispatch([E.SAVES_RENAME_WORKSPACE, 'one', ' My factory ']);
        await accept('one');
        expect(view.value('active')?.name).toBe('My factory');
        expect(view.value('selections')).toEqual({ one: { coreId: 1 } });
        const withoutSelectedCore = analyzeSave(snapshotFixture(), extractionContext);
        withoutSelectedCore.cores = withoutSelectedCore.cores.filter(core => core.id !== 1);
        await accept('one', withoutSelectedCore);
        expect(view.value('selections')).toEqual({ one: { coreId: null } });
        expect(telemetry.map(event => event.outcome)).toEqual(['success', 'success', 'success']);
    });

    it('clears hidden map selections and ignores invalid or stale map actions', async () => {
        const { app, view, accept } = await controlledImport();
        await accept('one');
        const before = view.value('active');
        await app.dispatchAll([
            [E.SAVES_RENAME_WORKSPACE, 'one', ' '], [E.SAVES_RENAME_WORKSPACE, 'one', 'x'.repeat(121)],
            [E.SAVES_RENAME_WORKSPACE, 'missing', 'Name'], [E.SAVES_REMOVE_WORKSPACE, 'missing'],
            [E.SAVES_SELECT_CORE, 'missing', 1], [E.SAVES_SELECT_CORE, 'one', -1],
            [E.SAVES_OPEN_CORE_ON_MAP, 'missing', 1], [E.SAVES_OPEN_CORE_ON_MAP, 'one', -1],
            [E.SAVES_SELECT_MAP_NODE, 'missing', 1], [E.SAVES_SELECT_MAP_NODE, 'one', -1],
            [E.SAVES_SET_MAP_BUILDING_FILTER, 'missing', []],
            [E.SAVES_SET_MAP_VIEWPORT, 'missing', 0, 0, 1], [E.SAVES_SET_MAP_VIEWPORT, 'one', NaN, 0, 1],
            [E.SAVES_SET_MAP_VIEWPORT, 'one', 0, 0, 0.001], [E.SAVES_SET_MAP_VIEWPORT, 'one', 0, 0, 4],
        ]);
        expect(view.value('active')).toEqual(before);
        expect(view.value('nodes')).toEqual({});
        expect(view.value('viewports')).toEqual({});
        await app.dispatch([E.SAVES_SELECT_MAP_NODE, 'one', 200]);
        await app.dispatch([E.SAVES_SELECT_MAP_NODE, 'one', 200]);
        expect(view.value('nodes')).toEqual({ one: 200 });
        await app.dispatch([E.SAVES_SET_MAP_BUILDING_FILTER, 'one', []]);
        expect(view.value('nodes')).toEqual({});
        expect(view.value('filters')).toEqual({ one: [] });
        const allTypes = before!.snapshot.cores.flatMap(core => core.buildings.map(building => building.buildingTypeId));
        await app.dispatch([E.SAVES_SET_MAP_BUILDING_FILTER, 'one', [...allTypes, 'unknown']]);
        expect(view.value('filters')).toEqual({});
        await app.dispatchAll([
            [E.SAVES_SELECT_MAP_NODE, 'one', 1], [E.SAVES_SELECT_MAP_NODE, 'one', null],
            [E.SAVES_SET_MAP_VIEWPORT, 'one', 10, 20, 0.5], [E.SAVES_SET_MAP_VIEWPORT, 'one', 10, 20, 0.5],
        ]);
        expect(view.value('nodes')).toEqual({});
        expect(view.value('viewports')).toEqual({ one: { x: 10, y: 20, zoom: 0.5 } });
    });

    it('rejects corrupt and oversized snapshots without replacing the accepted factory', async () => {
        const telemetry: SaveImportTelemetry[] = [];
        const { view, start, accept, app } = await controlledImport(event => telemetry.push(event));
        await accept('one');
        const original = view.value('active');
        const corrupt = analyzeSave(snapshotFixture(), extractionContext);
        corrupt.gameData.version = 'playtest';
        for (const [snapshot, error] of [
            [corrupt, 'structure'],
            [workspaceWithRandomNames(4000).snapshot, 'save-storage-limit'],
        ] as const) {
            const request = await start('one');
            await app.dispatch([E.SAVES_IMPORT_READY, request, snapshot, metrics]);
            expect(view.value('candidate')).toMatchObject({ phase: 'select', error });
            expect(view.value('active')).toEqual(original);
            expect(telemetry.at(-1)).toMatchObject({ outcome: 'failure', stage: 'workspace', error });
        }
        await app.dispatch([E.SAVES_IMPORT_CLOSE]);
        expect(view.value('candidate').phase).toBe('closed');
    });

    it('rejects a ninth workspace while preserving all eight existing factories', async () => {
        const telemetry: SaveImportTelemetry[] = [];
        const { app, view, accept } = await controlledImport(event => telemetry.push(event));
        for (let index = 0; index < 8; index++) await accept(`factory-${index}`);
        const original = view.value('workspaces');
        await accept('ninth');
        expect(view.value('workspaces')).toEqual(original);
        expect(view.value('candidate')).toMatchObject({ phase: 'select', error: 'workspace-limit' });
        expect(telemetry.at(-1)).toMatchObject({ outcome: 'failure', stage: 'workspace', error: 'workspace-limit' });
        await app.dispatch([E.SAVES_REMOVE_WORKSPACE, 'factory-7']);
        await accept('ninth');
        expect(view.value('active')?.id).toBe('ninth');
        expect(Object.keys(view.value('workspaces'))).toHaveLength(8);
    });

    it('cancels a deleted workspace import and a version change, ignoring late completions', async () => {
        const { app, view, accept, start } = await controlledImport();
        await accept('one');
        const request = await start('one');
        await app.dispatch([E.SAVES_IMPORT_OPEN, 'another']);
        await app.dispatch([E.SAVES_OPEN_DEMO, 'Demo']);
        expect(view.value('candidate')).toMatchObject({ phase: 'reading', targetWorkspaceId: 'one' });
        await app.dispatch([E.SAVES_REMOVE_WORKSPACE, 'one']);
        await app.dispatch([E.SAVES_IMPORT_READY, request, analyzeSave(snapshotFixture(), extractionContext), metrics]);
        expect(view.value('active')).toBeNull();
        expect(view.value('candidate').phase).toBe('closed');
        await start('two');
        await app.seed();
        expect(view.value('candidate').phase).toBe('closed');
        expect(view.value('workspaces')).toEqual({});
    });

    it('locks save mutations after a load failure, including an in-flight completion', async () => {
        const { app, view, accept, start } = await controlledImport();
        await accept('one');
        const original = view.value('workspaces');
        const request = await start('one');
        await app.dispatch([E.SAVES_STORAGE_FAILED, 'load']);
        await app.dispatchAll([
            [E.SAVES_STORAGE_FAILED, 'write'], [E.SAVES_IMPORT_READ, file], [E.SAVES_IMPORT_OPEN, 'two'],
            [E.SAVES_OPEN_DEMO, 'Demo'], [E.SAVES_RENAME_WORKSPACE, 'one', 'Changed'],
            [E.SAVES_REMOVE_WORKSPACE, 'one'], [E.SAVES_SELECT_CORE, 'one', 1], [E.SAVES_OPEN_CORE_ON_MAP, 'one', 1],
            [E.SAVES_IMPORT_READY, request, analyzeSave(snapshotFixture(), extractionContext), metrics],
        ]);
        expect(view.value('storage')).toBe('load');
        expect(view.value('candidate').phase).toBe('closed');
        expect(view.value('workspaces')).toEqual(original);
    });

    it.each(['playtest', 'update2_QoL'] as const)('reports unavailable save mappings for %s', async version => {
        const telemetry: SaveImportTelemetry[] = [];
        const app = createApp({ application: { effects: { onSaveImport: event => telemetry.push(event) } } });
        await app.seed(version);
        const view = app.mountView('missing mappings', { candidate: [S.SAVES_IMPORT], active: [S.SAVES_ACTIVE_WORKSPACE] } as const);
        await app.dispatch([E.SAVES_IMPORT_READ, file]);
        expect(view.value('candidate').phase).toBe('closed');
        await app.dispatch([E.SAVES_IMPORT_OPEN]);
        await app.dispatch([E.SAVES_IMPORT_READ, file]);
        const error = version === 'playtest' ? 'mapping-version' : 'mappings';
        expect(view.value('candidate')).toMatchObject({ phase: 'select', error, diagnostic: null });
        expect(view.value('active')).toBeNull();
        expect(telemetry).toEqual([expect.objectContaining({ outcome: 'failure', stage: 'prepare', error })]);
    });

    it('waits for game data before reading a file', async () => {
        const app = createApp({ application: { effects: { loadGameDataVersion: () => new Promise(() => {}) } } });
        await app.seed('update2_QoL', structuredClone(saveGameData));
        const view = app.mountView('pending game data', { candidate: [S.SAVES_IMPORT] } as const);
        await app.dispatch([E.SAVES_IMPORT_OPEN]);
        await app.dispatch([E.APP_REQUEST_LOAD_GAME_DATA, 'playtest']);
        await app.dispatch([E.SAVES_IMPORT_READ, file]);
        expect(view.value('candidate')).toMatchObject({ phase: 'select', error: null });
    });

    it('decodes a compressed save through the default Node adapter', async () => {
        const app = createApp();
        await app.seed('update2_QoL', structuredClone(saveGameData));
        const view = app.mountView('real save decoder', { candidate: [S.SAVES_IMPORT], active: [S.SAVES_ACTIVE_WORKSPACE] } as const);
        const text = JSON.stringify(saveFixture());
        const header = Buffer.alloc(4);
        header.writeUInt32LE(Buffer.byteLength(text));
        const bytes = Uint8Array.from(Buffer.concat([header, deflateSync(text)])).buffer;
        await app.dispatch([E.SAVES_IMPORT_OPEN]);
        await app.dispatch([E.SAVES_IMPORT_READ, { name: 'factory.sav', size: bytes.byteLength, arrayBuffer: async () => bytes }]);
        await vi.waitFor(async () => {
            await app.scenario.settle();
            expect(view.value('candidate').phase).toBe('closed');
            expect(view.value('active')?.snapshot.gameData.version).toBe('update2_QoL');
        });
    });
});
