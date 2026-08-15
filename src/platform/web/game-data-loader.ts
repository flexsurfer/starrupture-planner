import { gameDataBundleToAppVersioned, type GameDataBundle } from '@/app/uklad/game-data';
import type { RawCorporationsData } from '@/app/uklad/model';
import type { DataVersion } from '@/features/app-shell/data-version';

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

export async function loadGameDataVersion(version: DataVersion): Promise<GameDataBundle> {
    const hit = cache.get(version);
    if (hit) return hit;

    const [items, buildings, corporations] = await Promise.all([
        fetchJson<unknown>(gameDataFileUrl(version, FILES.items)),
        fetchJson<unknown>(gameDataFileUrl(version, FILES.buildings)),
        fetchJson<RawCorporationsData>(gameDataFileUrl(version, FILES.corporations)),
    ]);

    const bundle: GameDataBundle = { items, buildings, corporations };
    cache.set(version, bundle);
    return bundle;
}
