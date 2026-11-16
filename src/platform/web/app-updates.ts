import { getAppVersion } from '@/features/app-shell/app-version';

const CHECK_INTERVAL_MS = 5 * 60_000;
const RESUME_THROTTLE_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Browser ingress only; the caller publishes validated results into the existing runtime. */
export function watchAppUpdates(onAvailableVersion: (version: string | null) => void): () => void {
    const currentVersion = getAppVersion();
    let stopped = false;
    let pending: AbortController | null = null;
    let lastCheck = -Infinity;
    let reportedVersion: string | null = null;

    async function check(force = false) {
        if (stopped || pending || document.visibilityState === 'hidden' || navigator.onLine === false) return;
        const now = Date.now();
        if (!force && now - lastCheck < RESUME_THROTTLE_MS) return;
        lastCheck = now;
        const controller = new AbortController();
        pending = controller;
        const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const url = new URL(`${import.meta.env.BASE_URL}version.json`, window.location.href);
            // Bypass the browser cache. GitHub Pages can ignore query strings in its
            // CDN cache key, so this check can still lag a deployment by its cache TTL.
            url.searchParams.set('_', String(now));
            const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
            if (!response.ok) return;
            const manifest: unknown = await response.json();
            if (!manifest || typeof manifest !== 'object' || !('version' in manifest)
                || typeof manifest.version !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,63}$/.test(manifest.version)) return;
            if (stopped || controller.signal.aborted) return;
            // Any different deployment counts, including a rollback. Never compare version strings by order.
            const availableVersion = manifest.version === currentVersion ? null : manifest.version;
            if (availableVersion !== reportedVersion) {
                reportedVersion = availableVersion;
                onAvailableVersion(availableVersion);
            }
        } catch {
            // Offline, missing manifest or a failed request must not interrupt the planner.
        } finally {
            window.clearTimeout(timeout);
            if (pending === controller) pending = null;
        }
    }

    const resume = () => { void check(); };
    const online = () => { void check(true); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) void check(true); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', online);
    window.addEventListener('pageshow', restore);
    const interval = window.setInterval(resume, CHECK_INTERVAL_MS);
    resume();

    return () => {
        stopped = true;
        pending?.abort();
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', resume);
        window.removeEventListener('focus', resume);
        window.removeEventListener('online', online);
        window.removeEventListener('pageshow', restore);
    };
}

/** Avoid the browser's cached document URL while retaining the route; the CDN may still cache it. */
export function appUpdateUrl(href: string, version: string, now = Date.now()): string {
    const url = new URL(href);
    url.searchParams.set('_app_version', `${version}-${now}`);
    return url.href;
}

export function reloadForUpdate(version: string): void {
    window.location.replace(appUpdateUrl(window.location.href, version));
}
