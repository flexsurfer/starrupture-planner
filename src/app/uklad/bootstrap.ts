import { createUkladInspector } from '@ukladjs/core/devtools';
import { enableDevtools } from '@ukladjs/devtools';
import { localStorageAdapter, persist } from '@ukladjs/persist';
import { registerWebApplication } from './register';
import { createAppRuntime } from './runtime';
import { migrateLegacyStorage } from '@/state/legacy/legacy-storage-migration';
import { PERSIST_KEYS } from '@/state/persistence-config';

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
    enableDevtools(createUkladInspector(runtime), {
        operations: { evidence: { stateChanges: 'patches' } },
    });
}
