import type { UkladRuntime } from '@ukladjs/core/vanilla';
import { registerApplicationModules } from '@/app/uklad/register';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerHeadlessEffects } from './effects';

/** Installs shared features and Node-safe adapters for a browserless runtime. */
export function registerHeadlessApplication(runtime: UkladRuntime<AppContracts>): void {
    runtime.registerModule(registerApplicationModules);
    runtime.registerModule(registerHeadlessEffects);
}
