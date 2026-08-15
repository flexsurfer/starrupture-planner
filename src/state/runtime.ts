import { createUkladRuntime } from '@ukladjs/core/vanilla';
import { createUkladInspector } from '@ukladjs/core/devtools';
import { UkladProvider, useSubscription, useUkladRuntime } from '@ukladjs/core/react';
import { enableDevtools } from '@ukladjs/devtools';
import { localStorageAdapter, persist } from '@ukladjs/persist';
import { initialAppState } from './db';
import { registerEvents } from './events';
import { registerEffects } from './effects';
import { registerSubscriptions } from './subs';
import { migrateLegacyStorage } from './legacy/legacy-storage-migration';
import { PERSIST_KEYS } from './persistence-config';

const PERSIST_PREFIX = 'starrupture-planner';

export const runtime = createUkladRuntime({
    initialState: initialAppState,
    runtimeId: 'starrupture-planner',
    name: 'StarRupture Planner',
});

runtime.registerModule(registerEvents);
runtime.registerModule(registerEffects);
runtime.registerModule(registerSubscriptions);

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
export { UkladProvider, useSubscription, useUkladRuntime };
