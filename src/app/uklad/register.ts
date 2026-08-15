import type { UkladContracts, UkladRegistrar, UkladRuntime } from '@ukladjs/core/vanilla';
import { registerAppShellModule } from '@/features/app-shell/module';
import { registerWebEffects } from '@/platform/web/effects';
import { registerEvents } from '@/state/events';
import { registerSubscriptions } from '@/state/subs';
import type { AppContracts } from './contracts';

/** Installs shared features and exactly the browser platform adapters. */
export function registerWebApplication(runtime: UkladRuntime<AppContracts>): void {
    runtime.registerModule(registerAppShellModule);
    runtime.registerModule(registerWebEffects);

    runtime.registerModule(registerEvents);

    // Direct subscriptions are still receiving their per-query contract result
    // types. This temporary permissive registrar is only a TypeScript boundary;
    // it does not translate subscription inputs or results at runtime.
    runtime.registerModule((registrar) => {
        const untypedSubscriptionRegistrar = registrar as unknown as UkladRegistrar<UkladContracts>;
        registerSubscriptions(untypedSubscriptionRegistrar);
    });
}
