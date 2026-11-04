// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function serveBundledData(missingFile?: string) {
    const fetchJson = vi.fn(async (url: string) => {
        const file = new URL(`../../../${url.slice(import.meta.env.BASE_URL.length)}`, import.meta.url);
        if (missingFile && file.pathname.endsWith(`/${missingFile}`)) return new Response(null, { status: 404 });
        return new Response(await readFile(file, 'utf8'));
    });
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
    expect(fetchJson.mock.calls.every(([url]) => url.startsWith(`${import.meta.env.BASE_URL}assets/game-data/update2_QoL/`))).toBe(true);
    expect(await loadGameDataVersion('update2_QoL')).toBe(bundle);
    expect(fetchJson.mock.calls).toHaveLength(6);
});

it('retries a supported bundle after its save mappings failed to load', async () => {
    serveBundledData('save_items_mappings.json');
    const { loadGameDataVersion } = await import('./game-data-loader');
    expect((await loadGameDataVersion('update2_QoL')).saveBuildingCatalog).toBeNull();

    serveBundledData();
    expect((await loadGameDataVersion('update2_QoL')).saveBuildingCatalog?.stackSizes.helium).toBe(100);
});

it('loads older selected catalogs without requesting missing mappings or substituting another version', async () => {
    const fetchJson = serveBundledData();
    const { loadGameDataVersion } = await import('./game-data-loader');
    const bundle = await loadGameDataVersion('earlyaccess');
    expect(bundle.saveBuildingCatalog).toBeNull();
    expect(bundle.buildings).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'smelter' })]));
    expect(fetchJson.mock.calls).toHaveLength(3);
    expect(fetchJson.mock.calls.every(([url]) => url.startsWith(`${import.meta.env.BASE_URL}assets/game-data/earlyaccess/`))).toBe(true);
});
