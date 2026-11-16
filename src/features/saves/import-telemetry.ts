import type { DataVersion } from '@/features/app-shell/data-version';
import type { SaveImportDiagnostic } from './import-error';
import type { SaveImportState, SaveWorkspace } from './types';

/** Measurements from the reader; no file handles or save contents cross this boundary. */
export interface SaveImportMetrics {
    dataVersion: DataVersion;
    fileBytes: number;
    durationMs: number;
}

export type SaveImportMode = 'new' | 'update' | 'replace-demo';
export type SaveImportFailureStage = 'prepare' | 'decode' | 'workspace';

export type SaveImportTelemetry = SaveImportMetrics & { mode: SaveImportMode } & (
    | { outcome: 'success'; dataRevision: string; coreCount: number; buildingCount: number;
        powerNetworkCount: number; workspaceBytes: number }
    | { outcome: 'failure'; error: NonNullable<SaveImportState['error']>; stage: SaveImportFailureStage;
        diagnostic?: SaveImportDiagnostic }
);

export const saveImportMode = (previous?: SaveWorkspace): SaveImportMode =>
    previous?.isDemo ? 'replace-demo' : previous ? 'update' : 'new';

/** Count only retained objects. Names, IDs, positions and inventory contents are never reported. */
export function saveImportSummary(workspace: SaveWorkspace, workspaceBytes: number) {
    const networks = new Set<number>();
    let buildingCount = 0;
    for (const core of workspace.snapshot.cores) {
        if (core.powerNetworkId !== null) networks.add(core.powerNetworkId);
        buildingCount += core.buildings.length;
        for (const building of core.buildings) {
            if (building.powerNetworkId !== null) networks.add(building.powerNetworkId);
        }
    }
    return {
        dataRevision: workspace.snapshot.gameData.revision,
        coreCount: workspace.snapshot.cores.length,
        buildingCount,
        powerNetworkCount: networks.size,
        workspaceBytes,
    };
}
