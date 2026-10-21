// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';
import buildingMappings from '../../../assets/game-data/update2_QoL/save_buildings_mappings.json';
import itemMappings from '../../../assets/game-data/update2_QoL/save_items_mappings.json';
import recipeMappings from '../../../assets/game-data/update2_QoL/save_recipes_mappings.json';
import buildings from '../../../assets/game-data/update2_QoL/buildings_and_recipes.json';
import items from '../../../assets/game-data/update2_QoL/items_catalog.json';
import observedFixture from '@/features/saves/decoder/fixtures/observed-0.3.5.json';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { saveDataContext, extractionContext, saveFixture } from '@/features/saves/decoder/test-fixture';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules(); });

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
    const fetchJson = vi.fn(async (url: string) => ({ ok: true, json: async () => {
        if (url.endsWith('save_buildings_mappings.json')) return buildingMappings;
        if (url.endsWith('save_items_mappings.json')) return itemMappings;
        if (url.endsWith('save_recipes_mappings.json')) return recipeMappings;
        if (url.endsWith('buildings_and_recipes.json')) return buildings;
        return items;
    } }));
    vi.stubGlobal('fetch', fetchJson);
    const json = JSON.stringify(fixture);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(json));
    const bytes = Uint8Array.from(Buffer.concat([header, deflateSync(json)])).buffer;
    const report = analyzeSave(fixture, extractionContext);
    await import('./save-import-worker');
    const context = saveDataContext;
    await worker.onmessage({ data: { ...(file ? { file: new Blob([bytes]) } : { bytes }), context } } as MessageEvent);
    expect(fetchJson.mock.calls.map(([url]) => url)).toEqual([
        `${import.meta.env.BASE_URL}game-data/update2_QoL/save_buildings_mappings.json`,
        `${import.meta.env.BASE_URL}game-data/update2_QoL/save_items_mappings.json`,
        `${import.meta.env.BASE_URL}game-data/update2_QoL/save_recipes_mappings.json`,
    ]);
    expect(worker.postMessage).toHaveBeenCalledWith({ report });
});

it('reports mapping fetch failures without attempting to decode with partial mappings', async () => {
    const worker = { onmessage: null as unknown as (event: MessageEvent) => Promise<void>, postMessage: vi.fn() };
    vi.stubGlobal('self', worker);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('mappings.json')
        ? { ok: false, status: 404 }
        : { ok: true, json: async () => [{ id: 'item', name: 'Item' }] }));
    await import('./save-import-worker');
    await worker.onmessage({ data: { bytes: new ArrayBuffer(10), context: saveDataContext } } as MessageEvent);
    expect(worker.postMessage).toHaveBeenCalledWith({ error: 'mappings' });
});
