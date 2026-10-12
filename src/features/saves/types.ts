import type { SaveBuildingCatalog } from './game-data';
import type { SaveDataContext } from './decoder/types';
import type { SaveImportErrorCode } from './import-error';
import type { SaveSnapshot } from './snapshot';
import type { SaveFileSource } from './reader';

export interface SaveImportRequest extends SaveDataContext {
    requestId: number;
    targetWorkspaceId: string | null;
    file: SaveFileSource;
}

export type { SaveSnapshot } from './snapshot';

/** File selection and decoding are transient; a successful read opens its workspace. */
export interface SaveImportState {
    requestId: number;
    targetWorkspaceId: string | null;
    phase: 'closed' | 'select' | 'reading';
    fileName: string | null;
    error: SaveImportErrorCode | 'workspace-limit' | 'save-storage-limit' | null;
}

/** Snapshot replacement and user intent are scoped to this workspace. */
export interface SaveWorkspace {
    schemaVersion: 3;
    id: string;
    name: string;
    snapshot: SaveSnapshot;
    /** Keyed by coreKey(), not the Core's ID alone. */
    coreSettings: Record<string, { objective: SaveCoreObjective | null }>;
}

export type SaveCoreObjective =
    | { kind: 'corporation'; corporationId: string; level: number }
    | { kind: 'intermediate'; itemIds: string[] }
    | { kind: 'mission'; name: string; itemIds: string[] };

export interface SaveWorkspaceSelection {
    coreId: number | null;
}

export type SaveStorageError = 'load' | 'write' | null;

export interface SavesFeatureState {
    savesBuildingCatalog: SaveBuildingCatalog | null;
    savesImport: SaveImportState;
    savesWorkspaces: Record<string, SaveWorkspace>;
    savesWorkspaceOrder: string[];
    savesActiveWorkspaceId: string | null;
    savesSelections: Record<string, SaveWorkspaceSelection>;
    savesStorageError: SaveStorageError;
}
