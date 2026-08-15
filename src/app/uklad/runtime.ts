import { createUkladRuntime } from '@ukladjs/core/vanilla';
import type { AppContracts } from './contracts';
import { createAppState } from './initial-state';

/** Creates one isolated application graph for a browser root or a test fixture. */
export function createAppRuntime() {
    return createUkladRuntime<AppContracts>({
        initialState: createAppState(),
        runtimeId: 'starrupture-planner',
        name: 'StarRupture Planner',
    });
}
