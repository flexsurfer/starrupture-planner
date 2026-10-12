import { gameDataBundleToAppVersioned, type GameDataBundle } from '@/app/uklad/game-data';
import { createSaveBuildingCatalog } from '@/features/saves/game-data';
import type { Building, RawCorporationsData } from '@/app/uklad/model';
import { hasSaveMappings, type DataVersion } from '@/features/app-shell/data-version';
import { loadSaveDecodeContext, loadSaveMappings } from '@/features/saves/decoder/mappings';
import type { SaveDataContext } from '@/features/saves/decoder/types';

const FILES = {
    items: 'items_catalog.json',
    buildings: 'buildings_and_recipes.json',
    corporations: 'corporations_components.json',
} as const;

export { gameDataBundleToAppVersioned, type GameDataBundle };

function gameDataFileUrl(version: DataVersion, file: string): string {
    const base = import.meta.env.BASE_URL;
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${prefix}game-data/${version}/${file}`;
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load ${url} (${res.status})`);
    }
    return res.json() as Promise<T>;
}

const cache = new Map<DataVersion, GameDataBundle>();

export function loadWebSaveContext(context: SaveDataContext) {
    return loadSaveDecodeContext(context, file => fetchJson(gameDataFileUrl(context.dataVersion, file)));
}

export async function loadGameDataVersion(version: DataVersion): Promise<GameDataBundle> {
    const hit = cache.get(version);
    if (hit) return hit;

    const [items, buildings, corporations, mappings] = await Promise.all([
        fetchJson<unknown>(gameDataFileUrl(version, FILES.items)),
        fetchJson<unknown>(gameDataFileUrl(version, FILES.buildings)),
        fetchJson<RawCorporationsData>(gameDataFileUrl(version, FILES.corporations)),
        hasSaveMappings(version) ? loadSaveMappings(version, file => fetchJson(gameDataFileUrl(version, file))).catch(() => null) : null,
    ]);

    const bundle: GameDataBundle = { items, buildings, corporations,
        saveBuildingCatalog: mappings ? createSaveBuildingCatalog(mappings, buildings as Building[]) : null };
    cache.set(version, bundle);
    return bundle;
}
