import { createUkladInspector } from '@ukladjs/core/devtools';
import { enableDevtools, type UkladInspector } from '@ukladjs/devtools';
import { localStorageAdapter, persist } from '@ukladjs/persist';
import { registerWebApplication } from '@/app/uklad/register';
import { createAppRuntime } from '@/app/uklad/runtime';
import { migrateLegacyStorage } from '@/platform/web/legacy-storage/legacy-storage-migration';
import { PERSIST_KEYS } from './persistence';

const PERSIST_PREFIX = 'starrupture-planner';

/** The one browser-owned runtime and its platform lifecycle wiring. */
export const runtime = createAppRuntime();
registerWebApplication(runtime);

migrateLegacyStorage(PERSIST_PREFIX);

const persistence = persist(runtime, {
    storage: localStorageAdapter(),
    prefix: PERSIST_PREFIX,
    keys: PERSIST_KEYS,
});

persistence.hydrate();

if (import.meta.env.DEV) {
        // Core 0.2.4 added subscription kind "external"; published @ukladjs/devtools@0.2.0 types still omit it.
        enableDevtools(createUkladInspector(runtime) as unknown as UkladInspector, {
        operations: { evidence: { stateChanges: 'patches' } },
    });
}
