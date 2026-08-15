import { createUkladInspector } from '@ukladjs/core/devtools';
import { useSubscription, useUkladRuntime } from '@ukladjs/core/react';
import { enableDevtools } from '@ukladjs/devtools';
import { localStorageAdapter, persist } from '@ukladjs/persist';
import { UkladProvider, useRuntime as useAppRuntime, useSubscription as useAppSubscription } from '@/app/uklad/bindings';
import { registerWebApplication } from '@/app/uklad/register';
import { createAppRuntime } from '@/app/uklad/runtime';
import { migrateLegacyStorage } from './legacy/legacy-storage-migration';
import { PERSIST_KEYS } from './persistence-config';

const PERSIST_PREFIX = 'starrupture-planner';

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

export const dispatch = runtime.dispatch.bind(runtime);
export { UkladProvider, useAppRuntime, useAppSubscription, useSubscription, useUkladRuntime };
