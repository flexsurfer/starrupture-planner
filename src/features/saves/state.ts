import type { SaveImportState, SavesFeatureState } from './types';

export function createSaveImportState(requestId = 0): SaveImportState {
    return { requestId, targetWorkspaceId: null, phase: 'closed', fileName: null, error: null };
}

export function createSavesFeatureState(): SavesFeatureState {
    return {
        savesBuildingCatalog: null,
        savesImport: createSaveImportState(),
        savesWorkspaces: {},
        savesWorkspaceOrder: [],
        savesActiveWorkspaceId: null,
        savesSelections: {},
        savesStorageError: null,
    };
}
