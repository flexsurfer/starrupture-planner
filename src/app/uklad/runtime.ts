import { createUkladRuntime } from '@ukladjs/core/vanilla';
import type { AppContracts } from './contracts';
import { createAppState } from './initial-state';

type AppRuntimeOptions = {
    runtimeId?: string;
    name?: string;
};

/** Creates one isolated application graph for a browser root or a test fixture. */
export function createAppRuntime({
    runtimeId = 'starrupture-planner',
    name = 'StarRupture Planner',
}: AppRuntimeOptions = {}) {
    return createUkladRuntime<AppContracts>({
        initialState: createAppState(),
        runtimeId,
        name,
    });
}
