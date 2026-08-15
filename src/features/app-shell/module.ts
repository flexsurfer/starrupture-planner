import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerAppShellEvents } from './events';
import { registerAppShellSubscriptions } from './subscriptions';

export const registerAppShellModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerAppShellEvents(registrar);
    registerAppShellSubscriptions(registrar);
};
