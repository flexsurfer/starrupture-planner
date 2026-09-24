import { createUkladRuntime } from '@ukladjs/core/vanilla';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import type { AppContracts } from './contracts';
import { createAppState } from './initial-state';

type AppRuntimeOptions = {
    runtimeId?: string;
    name?: string;
    initialLocale?: string;
};

/** Creates one isolated application graph for a browser root or a test fixture. */
export function createAppRuntime({
    runtimeId = 'starrupture-planner',
    name = 'StarRupture Planner',
    initialLocale = DEFAULT_LOCALE,
}: AppRuntimeOptions = {}) {
    return createUkladRuntime<AppContracts>({
        initialState: createAppState(initialLocale),
        runtimeId,
        name,
    });
}
