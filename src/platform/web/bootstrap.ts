import { createUkladInspector } from '@ukladjs/core/devtools';
import { enableDevtools } from '@ukladjs/devtools';
import { localStorageAdapter, persist } from '@ukladjs/persist';
import { registerWebApplication } from '@/app/uklad/register';
import { createAppRuntime } from '@/app/uklad/runtime';
import { localeFromPreferences } from '@/shared/i18n/locales';
import { migrateLegacyStorage } from '@/platform/web/legacy-storage/legacy-storage-migration';
import { PERSIST_KEYS, SAVES_PERSIST_ROOTS } from './persistence';
import { createSavesStorage } from './saves-storage';
import { appIds } from '@/app/uklad/catalog';

const PERSIST_PREFIX = 'starrupture-planner';

/** The one browser-owned runtime and its platform lifecycle wiring. */
const browserLanguages = typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length ? navigator.languages : [navigator.language];
export const runtime = createAppRuntime({ initialLocale: localeFromPreferences(browserLanguages) });
registerWebApplication(runtime);

migrateLegacyStorage(PERSIST_PREFIX);

const savesStorage = createSavesStorage(localStorageAdapter(), PERSIST_PREFIX);
export const persistence = persist(runtime, {
    storage: savesStorage.storage,
    prefix: PERSIST_PREFIX,
    keys: PERSIST_KEYS,
    onError: ({ phase, key }) => {
        if (phase === 'write' || phase === 'serialize') {
            if (key && SAVES_PERSIST_ROOTS.some(root => root === key)) runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'write']);
        } else {
            // Any hydration failure prevents Persist from writing its roots.
            runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'load']);
        }
    },
});

persistence.hydrate();
if (savesStorage.hasLoadError()) runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'load']);
runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);

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
