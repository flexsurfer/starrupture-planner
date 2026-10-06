import { createUkladInspector } from '@ukladjs/core/devtools';
import { enableDevtools } from '@ukladjs/devtools';
import { localStorageAdapter, persist } from '@ukladjs/persist';
import { registerWebApplication } from '@/app/uklad/register';
import { createAppRuntime } from '@/app/uklad/runtime';
import { localeFromPreferences } from '@/shared/i18n/locales';
import { migrateLegacyStorage } from '@/platform/web/legacy-storage/legacy-storage-migration';
import { PERSIST_KEYS } from './persistence';
import { appIds } from '@/app/uklad/catalog';

const PERSIST_PREFIX = 'starrupture-planner';

/** The one browser-owned runtime and its platform lifecycle wiring. */
const browserLanguages = typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length ? navigator.languages : [navigator.language];
export const runtime = createAppRuntime({ initialLocale: localeFromPreferences(browserLanguages) });
registerWebApplication(runtime);

migrateLegacyStorage(PERSIST_PREFIX);

const persistence = persist(runtime, {
    storage: localStorageAdapter(),
    prefix: PERSIST_PREFIX,
    keys: PERSIST_KEYS,
});

persistence.hydrate();

// Initialize game data once, when an entry point first mounts the tools.
let toolsInitialized = false;
export function initializeTools() {
    if (toolsInitialized) return;
    toolsInitialized = true;
    runtime.dispatch([appIds.events.APP_INIT]);
}

if (import.meta.env.DEV) {
    enableDevtools(createUkladInspector(runtime), {
        operations: { evidence: { stateChanges: 'patches' } },
    });
}
