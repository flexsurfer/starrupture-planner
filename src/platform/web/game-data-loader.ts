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

// Vite gives changed files new URLs in both the page and the save worker.
const gameDataUrls = import.meta.glob<string>('./*/*.json', {
    base: '../../../assets/game-data', query: '?url&no-inline', import: 'default', eager: true,
});

async function fetchGameData<T>(version: DataVersion, file: string): Promise<T> {
    const url = gameDataUrls[`./${version}/${file}`];
    if (!url) throw new Error(`Missing game data file: ${version}/${file}`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load ${url} (${res.status})`);
    }
    return res.json() as Promise<T>;
}

const cache = new Map<DataVersion, GameDataBundle>();

export function loadWebSaveContext(context: SaveDataContext) {
    return loadSaveDecodeContext(context, file => fetchGameData(context.dataVersion, file));
}

export async function loadGameDataVersion(version: DataVersion): Promise<GameDataBundle> {
    const hit = cache.get(version);
    if (hit) return hit;

    const expectsMappings = hasSaveMappings(version);
    const [items, buildings, corporations, mappings] = await Promise.all([
        fetchGameData<unknown>(version, FILES.items),
        fetchGameData<unknown>(version, FILES.buildings),
        fetchGameData<RawCorporationsData>(version, FILES.corporations),
        expectsMappings ? loadSaveMappings(version, file => fetchGameData(version, file)).catch(() => null) : null,
    ]);

    const bundle: GameDataBundle = { items, buildings, corporations,
        saveBuildingCatalog: mappings ? createSaveBuildingCatalog(mappings, buildings as Building[]) : null };
    if (!expectsMappings || mappings) cache.set(version, bundle);
    return bundle;
}
