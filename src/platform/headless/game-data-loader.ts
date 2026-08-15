import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gameDataBundleToAppVersioned, type GameDataBundle } from '@/app/uklad/game-data';
import type { RawCorporationsData } from '@/app/uklad/model';
import type { DataVersion } from '@/features/app-shell/data-version';

const FILES = {
    items: 'items_catalog.json',
    buildings: 'buildings_and_recipes.json',
    corporations: 'corporations_components.json',
} as const;

const cache = new Map<DataVersion, GameDataBundle>();

async function readJson<T>(version: DataVersion, file: string): Promise<T> {
    const path = resolve(process.cwd(), 'assets', 'game-data', version, file);
    return JSON.parse(await readFile(path, 'utf8')) as T;
}

/** Reads the bundled public game data without requiring a browser or network access. */
export async function loadHeadlessGameDataVersion(version: DataVersion): Promise<GameDataBundle> {
    const hit = cache.get(version);
    if (hit) return hit;

    const [items, buildings, corporations] = await Promise.all([
        readJson<unknown>(version, FILES.items),
        readJson<unknown>(version, FILES.buildings),
        readJson<RawCorporationsData>(version, FILES.corporations),
    ]);

    const bundle = { items, buildings, corporations };
    cache.set(version, bundle);
    return bundle;
}

export { gameDataBundleToAppVersioned };
