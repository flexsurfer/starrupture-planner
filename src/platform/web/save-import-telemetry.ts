import type { SaveImportTelemetry } from '@/features/saves/import-telemetry';

type EventData = Record<string, string | number>;
interface UmamiTracker {
    track(name: string, data: EventData): unknown;
}

/** Use the existing deploy-time tracker. Missing/blocked analytics must not affect imports. */
export function trackSaveImport(telemetry: SaveImportTelemetry): void {
    if (import.meta.env.VITE_UMAMI_ENABLED !== 'true') return;
    try {
        if (typeof window === 'undefined') return;
        const umami = (window as Window & { umami?: UmamiTracker }).umami;
        if (typeof umami?.track !== 'function') return;
        // Explicit allowlist: never spread a snapshot, file, exception or external payload here.
        const data: EventData = {
            release: import.meta.env.VITE_APP_RELEASE ?? 'unknown',
            data_version: telemetry.dataVersion,
            mode: telemetry.mode,
            file_bytes: telemetry.fileBytes,
            duration_ms: telemetry.durationMs,
        };
        if (telemetry.outcome === 'success') {
            Object.assign(data, {
                data_revision: telemetry.dataRevision,
                core_count: telemetry.coreCount,
                building_count: telemetry.buildingCount,
                power_network_count: telemetry.powerNetworkCount,
                workspace_bytes: telemetry.workspaceBytes,
            });
        } else {
            data.error = telemetry.error;
            data.stage = telemetry.stage;
            if (telemetry.error === 'complexity' && telemetry.diagnostic) {
                data.subcode = telemetry.diagnostic.subcode;
                data.actual = telemetry.diagnostic.actual;
                data.limit = telemetry.diagnostic.limit;
            }
        }
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) delete data[key];
        }
        void Promise.resolve(umami.track(telemetry.outcome === 'success' ? 'save_import_succeeded' : 'save_import_failed', data))
            .catch(() => {});
    } catch {
        // Tracker failures are best-effort and must never become import failures.
    }
}
