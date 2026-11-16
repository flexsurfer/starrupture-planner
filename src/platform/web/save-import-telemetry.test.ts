import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SaveImportTelemetry } from '@/features/saves/import-telemetry';
import { trackSaveImport } from './save-import-telemetry';

const success = {
    outcome: 'success', mode: 'new', dataVersion: 'update2_QoL', dataRevision: 'catalog-revision',
    fileBytes: 32_431_209, durationMs: 1234, coreCount: 4, buildingCount: 200, powerNetworkCount: 7, workspaceBytes: 90_000,
} as const satisfies SaveImportTelemetry;

beforeEach(() => {
    vi.stubEnv('VITE_UMAMI_ENABLED', 'true');
    vi.stubEnv('VITE_APP_VERSION', '2026.11.16-120000');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(['false', undefined, '', '1'] as const)('does not use an existing tracker without the website build flag (%s)', flag => {
    const track = vi.fn();
    vi.stubGlobal('umami', { track });
    vi.stubEnv('VITE_UMAMI_ENABLED', flag);
    trackSaveImport(success);
    trackSaveImport({ outcome: 'failure', mode: 'new', dataVersion: 'update2_QoL', fileBytes: 20,
        durationMs: 10, error: 'read', stage: 'decode' });
    expect(track).not.toHaveBeenCalled();
});

it('sends one flat success event with an explicit allowlist and the build release', async () => {
    const track = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('umami', { track });
    vi.stubEnv('VITE_APP_RELEASE', 'abc123');
    const input = { ...success, fileName: 'private.sav', snapshot: { name: 'Private core' }, savedAt: 'Private timestamp' };
    trackSaveImport(input);
    await Promise.resolve();
    expect(track).toHaveBeenCalledExactlyOnceWith('save_import_succeeded', {
        app_version: '2026.11.16-120000',
        release: 'abc123', data_version: 'update2_QoL', data_revision: 'catalog-revision', mode: 'new',
        file_bytes: 32_431_209, duration_ms: 1234, core_count: 4, building_count: 200, power_network_count: 7, workspace_bytes: 90_000,
    });
});

it('sends exact limit diagnostics without including raw error messages or unrelated diagnostic fields', () => {
    const track = vi.fn();
    vi.stubGlobal('umami', { track });
    vi.stubEnv('VITE_APP_RELEASE', 'abc123');
    const diagnostic = { subcode: 'projection-chars', actual: 16_780_000, limit: 16_777_216, source: 'Private source record' } as const;
    trackSaveImport({ outcome: 'failure', mode: 'update', dataVersion: 'update2_QoL', fileBytes: 30_000_000,
        durationMs: 10_000, error: 'complexity', stage: 'decode', diagnostic });
    expect(track).toHaveBeenCalledExactlyOnceWith('save_import_failed', {
        app_version: '2026.11.16-120000',
        release: 'abc123', data_version: 'update2_QoL', mode: 'update', file_bytes: 30_000_000, duration_ms: 10_000,
        error: 'complexity', stage: 'decode', subcode: 'projection-chars', actual: 16_780_000, limit: 16_777_216,
    });
});

it('does not attach stale diagnostics to non-complexity errors or send invalid numeric measurements', () => {
    const track = vi.fn();
    vi.stubGlobal('umami', { track });
    trackSaveImport({ outcome: 'failure', mode: 'new', dataVersion: 'update2_QoL', fileBytes: NaN,
        durationMs: 0, error: 'file-size', stage: 'decode', diagnostic: { subcode: 'json-depth', actual: Infinity, limit: -1 } });
    expect(track).toHaveBeenCalledOnce();
    const [, data] = track.mock.calls[0];
    expect(data).toMatchObject({ error: 'file-size', duration_ms: 0 });
    for (const key of ['file_bytes', 'subcode', 'actual', 'limit']) expect(data).not.toHaveProperty(key);
});

it.each(['missing', 'throws', 'rejects', 'pending'] as const)('keeps imports independent of analytics when the tracker %s', async mode => {
    const track = vi.fn(() => {
        if (mode === 'throws') throw new Error('Tracker failed');
        if (mode === 'rejects') return Promise.reject(new Error('Network blocked'));
        return new Promise(() => {});
    });
    vi.stubGlobal('umami', mode === 'missing' ? undefined : { track });
    expect(trackSaveImport(success)).toBeUndefined();
    await Promise.resolve();
    expect(track).toHaveBeenCalledTimes(mode === 'missing' ? 0 : 1);
});
