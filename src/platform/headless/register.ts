import type { UkladRuntime } from '@ukladjs/core/vanilla';
import { registerApplicationModules } from '@/app/uklad/register';
import type { AppContracts } from '@/app/uklad/contracts';
import { createHeadlessEffects, type HeadlessEffectOptions } from './effects';

export interface HeadlessApplicationOptions {
    effects?: HeadlessEffectOptions;
}

/** Installs shared features and Node-safe adapters for a browserless runtime. */
export function registerHeadlessApplication(
    runtime: UkladRuntime<AppContracts>,
    { effects }: HeadlessApplicationOptions = {},
): void {
    runtime.registerModule(registerApplicationModules);
    runtime.registerModule(createHeadlessEffects(effects));
}
