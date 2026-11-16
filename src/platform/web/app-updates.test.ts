import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appUpdateUrl, watchAppUpdates } from './app-updates';

const loadedVersion = '2026.11.16-120000';
const nextVersion = '2026.11.16-130000';
const fetchMock = vi.fn<typeof fetch>();
let stop: (() => void) | undefined;

function manifest(version: unknown) {
    return { ok: true, json: async () => ({ version }) } as Response;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_APP_VERSION', loadedVersion);
    vi.stubGlobal('fetch', fetchMock.mockReset());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

it('checks fresh deployment metadata, reports a changed build once and clears on rollback to the loaded build', async () => {
    fetchMock.mockResolvedValue(manifest(loadedVersion));
    const notify = vi.fn();
    stop = watchAppUpdates(notify);
    await vi.advanceTimersByTimeAsync(0);
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe('/version.json');
    expect(new URL(String(url)).searchParams.has('_')).toBe(true);
    expect(options?.cache).toBe('no-store');
    expect(notify).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(manifest(nextVersion));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(notify).toHaveBeenCalledExactlyOnceWith(nextVersion);
    expect(String(fetchMock.mock.calls[1][0])).not.toBe(String(url));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(notify).toHaveBeenCalledOnce();

    // Rollbacks are deployments too; no lexical/semantic version ordering is assumed.
    fetchMock.mockResolvedValue(manifest('2026.11.15-090000'));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(notify).toHaveBeenLastCalledWith('2026.11.15-090000');
    fetchMock.mockResolvedValue(manifest(loadedVersion));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(notify).toHaveBeenLastCalledWith(null);
});

it('throttles focus checks, skips hidden/offline tabs and checks on return or reconnection', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    const online = vi.spyOn(navigator, 'onLine', 'get');
    fetchMock.mockResolvedValue(manifest(loadedVersion));
    stop = watchAppUpdates(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();

    visibility.mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    online.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
});

it.each([null, '', 42, ' ', 'x'.repeat(65), '<script>', { version: nextVersion }])('ignores invalid version metadata (%j)', async version => {
    fetchMock.mockResolvedValue(manifest(version));
    const notify = vi.fn();
    stop = watchAppUpdates(notify);
    await vi.advanceTimersByTimeAsync(0);
    expect(notify).not.toHaveBeenCalled();
});

it('survives missing manifests, invalid JSON and offline failures, then recovers on the next check', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('HTML fallback'); } } as unknown as Response)
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(manifest(nextVersion));
    const notify = vi.fn();
    stop = watchAppUpdates(notify);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(notify).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(notify).toHaveBeenCalledExactlyOnceWith(nextVersion);
});

it('aborts stalled requests and retries later without overlapping requests', async () => {
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })).mockResolvedValue(manifest(nextVersion));
    const notify = vi.fn();
    stop = watchAppUpdates(notify);
    window.dispatchEvent(new Event('online'));
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(notify).toHaveBeenCalledExactlyOnceWith(nextVersion);
});

it('removes listeners and ignores results arriving after unmount', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(done => { resolve = done; }));
    const notify = vi.fn();
    stop = watchAppUpdates(notify);
    stop();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    resolve(manifest(nextVersion));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(notify).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});

it('reloads the same route with a fresh document URL while preserving existing query values and hash', () => {
    const url = new URL(appUpdateUrl('https://example.com/planner/?plan=abc&_app_version=old#section', nextVersion, 1234));
    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe('/planner/');
    expect(url.searchParams.get('plan')).toBe('abc');
    expect(url.searchParams.getAll('_app_version')).toEqual([`${nextVersion}-1234`]);
    expect(url.hash).toBe('#section');
});
