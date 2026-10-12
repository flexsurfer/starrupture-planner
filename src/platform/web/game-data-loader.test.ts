// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function serveBundledData() {
    const fetchJson = vi.fn(async (url: string) => ({
        ok: true,
        json: async () => JSON.parse(await readFile(new URL(`../../../assets/${url.replace(import.meta.env.BASE_URL, '')}`, import.meta.url), 'utf8')),
    }));
    vi.stubGlobal('fetch', fetchJson);
    return fetchJson;
}

it('loads version-specific save metadata with the selected catalogs and caches the bundle', async () => {
    const fetchJson = serveBundledData();
    const { loadGameDataVersion } = await import('./game-data-loader');
    const bundle = await loadGameDataVersion('update2_QoL');
    expect(bundle.saveBuildingCatalog).toMatchObject({
        kinds: { ore_excavator: 'extractor', package_dispatcher: 'dispatcher' },
        extractionRates: { 'ore_excavator:ore_titanium:pure': 240 },
    });
    expect(fetchJson.mock.calls).toHaveLength(6);
    expect(fetchJson.mock.calls.every(([url]) => url.startsWith(`${import.meta.env.BASE_URL}game-data/update2_QoL/`))).toBe(true);
    expect(await loadGameDataVersion('update2_QoL')).toBe(bundle);
    expect(fetchJson.mock.calls).toHaveLength(6);
});

it('loads older selected catalogs without requesting missing mappings or substituting another version', async () => {
    const fetchJson = serveBundledData();
    const { loadGameDataVersion } = await import('./game-data-loader');
    const bundle = await loadGameDataVersion('earlyaccess');
    expect(bundle.saveBuildingCatalog).toBeNull();
    expect(bundle.buildings).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'smelter' })]));
    expect(fetchJson.mock.calls).toHaveLength(3);
    expect(fetchJson.mock.calls.every(([url]) => url.startsWith(`${import.meta.env.BASE_URL}game-data/earlyaccess/`))).toBe(true);
});
