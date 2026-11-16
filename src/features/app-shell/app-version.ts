/** Identifies the loaded bundle, never the latest version reported by the server. */
export function getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION ?? 'dev';
}

export function getAppRelease(): string {
    return import.meta.env.VITE_APP_RELEASE ?? 'unknown';
}
