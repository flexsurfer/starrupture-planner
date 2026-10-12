import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

const cache = new Map<DataVersion, GameDataBundle>();

export function loadHeadlessSaveMappings(version: DataVersion) {
    return loadSaveMappings(version, file => readJson(version, file));
}

export function loadHeadlessSaveContext(context: SaveDataContext) {
    return loadSaveDecodeContext(context, file => readJson(context.dataVersion, file));
}

async function readJson<T>(version: DataVersion, file: string): Promise<T> {
    const path = resolve(process.cwd(), 'assets', 'game-data', version, file);
    return JSON.parse(await readFile(path, 'utf8')) as T;
}

/** Reads the bundled public game data without requiring a browser or network access. */
export async function loadHeadlessGameDataVersion(version: DataVersion): Promise<GameDataBundle> {
    const hit = cache.get(version);
    if (hit) return hit;

    const [items, buildings, corporations, mappings] = await Promise.all([
        readJson<unknown>(version, FILES.items),
        readJson<unknown>(version, FILES.buildings),
        readJson<RawCorporationsData>(version, FILES.corporations),
        hasSaveMappings(version) ? loadSaveMappings(version, file => readJson(version, file)).catch(() => null) : null,
    ]);

    const bundle = { items, buildings, corporations,
        saveBuildingCatalog: mappings ? createSaveBuildingCatalog(mappings, buildings as Building[]) : null };
    cache.set(version, bundle);
    return bundle;
}

export { gameDataBundleToAppVersioned };
