import type { SaveSnapshot } from './snapshot';
import type { SavesFeatureState, SaveWorkspace } from './types';
import { normalizeSaveWorkspace } from './storage-schema';

/** Each imported save owns a detached snapshot. */
export function createSaveWorkspace(id: string, name: string, snapshot: SaveSnapshot): SaveWorkspace {
    return normalizeSaveWorkspace({ schemaVersion: 1, id, name, snapshot });
}

export function workspaceIds(workspaces: Record<string, SaveWorkspace>, order: string[]) {
    return [...new Set([...order, ...Object.keys(workspaces)])].filter(id => Object.hasOwn(workspaces, id));
}

export function getActiveSaveWorkspace({ savesWorkspaces, savesWorkspaceOrder, savesActiveWorkspaceId }: Pick<SavesFeatureState,
    'savesWorkspaces' | 'savesWorkspaceOrder' | 'savesActiveWorkspaceId'>): SaveWorkspace | null {
    return (savesActiveWorkspaceId && Object.hasOwn(savesWorkspaces, savesActiveWorkspaceId)
        ? savesWorkspaces[savesActiveWorkspaceId] : savesWorkspaces[workspaceIds(savesWorkspaces, savesWorkspaceOrder)[0]]) ?? null;
}
