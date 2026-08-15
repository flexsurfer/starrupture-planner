import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerPlannerEvents } from './events';
import { registerPlannerSubscriptions } from './subscriptions';

export const registerPlannerModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerPlannerEvents(registrar);
    registerPlannerSubscriptions(registrar);
};
