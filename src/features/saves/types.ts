import type { MapDisplaySettings, MapLayers } from './map-preferences';
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
    schemaVersion: 1;
    id: string;
    name: string;
    snapshot: SaveSnapshot;
}

export interface SaveWorkspaceSelection {
    coreId: number | null;
}

export interface SaveMapViewport { x: number; y: number; zoom: number }

export type SaveView = 'map' | 'overview' | 'power-networks';

export type SaveStorageError = 'load' | 'write' | null;

export interface SavesFeatureState {
    savesBuildingCatalog: SaveBuildingCatalog | null;
    savesImport: SaveImportState;
    savesWorkspaces: Record<string, SaveWorkspace>;
    savesWorkspaceOrder: string[];
    savesActiveWorkspaceId: string | null;
    /** View selection lasts for this runtime session only. */
    savesSelectedView: SaveView;
    savesMapSelectedNodes: Record<string, number>;
    savesMapDisplay: MapDisplaySettings;
    savesMapLayers: MapLayers;
    /** Building-type selections are scoped to each save for this runtime session. */
    /** Missing entries show all building types; an empty selection hides all buildings. */
    savesMapBuildingFilters: Record<string, string[]>;
    savesMapViewports: Record<string, SaveMapViewport>;
    savesSelections: Record<string, SaveWorkspaceSelection>;
    savesStorageError: SaveStorageError;
}
