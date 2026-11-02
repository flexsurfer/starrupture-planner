import demoSnapshot from './demo-snapshot.json';
import type { SaveGameData } from './game-data';
import type { SaveSnapshot } from './snapshot';
import { normalizeSaveSnapshot, validateSaveSnapshotCatalog } from './storage-schema';

/**
 * Curated from internal/6.sav: Base Helium 1, Base Core 1, Core 8 and Core 9.
 * Keeps their layouts, production and cargo links, with descriptive demo names.
 * Only these four normalized Cores are bundled; the save date and building nicknames are omitted.
 */
export function createDemoSnapshot(version: string, data: SaveGameData): SaveSnapshot {
    const snapshot = normalizeSaveSnapshot(demoSnapshot);
    validateSaveSnapshotCatalog(snapshot, version, data);
    return snapshot;
}
