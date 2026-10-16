import { registerPlannerResourceEvents } from './resource-events';
import { registerPlannerResourceSubscriptions } from './resource-subscriptions';
import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerPlannerEvents } from './events';
import { registerPlannerSubscriptions } from './subscriptions';

export const registerPlannerModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerPlannerEvents(registrar);
    registerPlannerResourceEvents(registrar);
    registerPlannerSubscriptions(registrar);
    registerPlannerResourceSubscriptions(registrar);
};
