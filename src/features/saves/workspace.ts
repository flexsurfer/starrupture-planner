import { coreKey, type SaveSnapshot } from './snapshot';
import type { SaveWorkspace } from './types';
import { normalizeSaveWorkspace } from './storage-schema';

/** Rebuild the snapshot; carry forward settings only for exactly matching Core identities. */
export function createSaveWorkspace(id: string, name: string, snapshot: SaveSnapshot, previous?: SaveWorkspace): SaveWorkspace {
    const keys = new Set(snapshot.cores.map(coreKey));
    const coreSettings = Object.fromEntries(Object.entries(previous?.id === id ? previous.coreSettings : {}).filter(([key]) => keys.has(key)));
    return normalizeSaveWorkspace({ schemaVersion: 3, id, name, snapshot, coreSettings });
}

export function workspaceIds(workspaces: Record<string, SaveWorkspace>, order: string[]) {
    return [...new Set([...order, ...Object.keys(workspaces)])].filter(id => Object.hasOwn(workspaces, id));
}
