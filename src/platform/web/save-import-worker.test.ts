// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';
import buildingMappings from '../../../game-data/update2_QoL/save_buildings_mappings.json';
import itemMappings from '../../../game-data/update2_QoL/save_items_mappings.json';
import recipeMappings from '../../../game-data/update2_QoL/save_recipes_mappings.json';
import observedFixture from '@/features/saves/decoder/fixtures/observed-0.3.5.json';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { saveDataContext, extractionContext, saveFixture } from '@/features/saves/decoder/test-fixture';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules(); });

function stubMappings() {
    const directory = `${import.meta.env.BASE_URL}game-data/update2_QoL`;
    const files = new Map<string, unknown>([
        [`${directory}/save_buildings_mappings.json`, buildingMappings],
        [`${directory}/save_items_mappings.json`, itemMappings],
        [`${directory}/save_recipes_mappings.json`, recipeMappings],
    ]);
    const fetchJson = vi.fn(async (url: string) => {
        const path = new URL(url, 'http://localhost').pathname;
        return { ok: files.has(path), json: async () => files.get(path) };
    });
    vi.stubGlobal('fetch', fetchJson);
    return { files, fetchJson };
}

// The sanitized source fixture intentionally omitted placement identity; supply an explicit
// synthetic value here to exercise its real recipe/transport shapes through the worker.
const observedWithIdentity = structuredClone(observedFixture);
for (const entity of Object.values(observedWithIdentity.itemData.Mass.entities)) {
    if (entity.spawnData.entityConfigDataPath.includes('/BaseCore/')) {
        entity.fragmentValues.push('/Script/AuActorPlacement.AuAPMassFragment(SpawnServerTimeSeconds=10.5)');
    }
}
it.each([{ name: 'synthetic bytes', fixture: saveFixture(), file: false }, { name: 'synthetic file', fixture: saveFixture(), file: true },
    { name: 'observed with synthetic identity', fixture: observedWithIdentity, file: true }])('loads selected mappings and normalizes the $name snapshot in the worker', async ({ fixture, file }) => {
    const worker = { onmessage: null as unknown as (event: MessageEvent) => Promise<void>, postMessage: vi.fn() };
    vi.stubGlobal('self', worker);
    const { files, fetchJson } = stubMappings();
    const json = JSON.stringify(fixture);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(json));
    const bytes = Uint8Array.from(Buffer.concat([header, deflateSync(json)])).buffer;
    const report = analyzeSave(fixture, extractionContext);
    await import('./save-import-worker');
    const context = saveDataContext;
    await worker.onmessage({ data: { ...(file ? { file: new Blob([bytes]) } : { bytes }), context } } as MessageEvent);
    expect(fetchJson.mock.calls.map(([url]) => new URL(url, 'http://localhost').pathname)).toEqual([...files.keys()]);
    expect(worker.postMessage).toHaveBeenCalledWith({ report });
});

it('sends a real decoder limit diagnostic as cloneable data without source content', async () => {
    const worker = { onmessage: null as unknown as (event: MessageEvent) => Promise<void>, postMessage: vi.fn() };
    vi.stubGlobal('self', worker);
    stubMappings();
    const fixture = saveFixture();
    fixture.itemData.CrBuildingCustomNameSubsystem.customNames['(ID=1)'] = 'private name '.repeat(43);
    const json = JSON.stringify(fixture);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(json));
    const file = new Blob([header, deflateSync(json)]);
    await import('./save-import-worker');
    await worker.onmessage({ data: { file, context: saveDataContext } } as MessageEvent);
    expect(structuredClone(worker.postMessage.mock.calls[0][0])).toEqual({ error: 'complexity', diagnostic: {
        subcode: 'building-name-chars', actual: 559, limit: 512,
    } });
});

it('reports mapping fetch failures without attempting to decode with partial mappings', async () => {
    const worker = { onmessage: null as unknown as (event: MessageEvent) => Promise<void>, postMessage: vi.fn() };
    vi.stubGlobal('self', worker);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await import('./save-import-worker');
    await worker.onmessage({ data: { bytes: new ArrayBuffer(10), context: saveDataContext } } as MessageEvent);
    expect(worker.postMessage).toHaveBeenCalledWith({ error: 'mappings' });
});
