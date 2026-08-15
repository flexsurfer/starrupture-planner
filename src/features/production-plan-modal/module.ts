import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerProductionPlanModalEvents } from './events';
import { registerProductionPlanModalSubscriptions } from './subscriptions';

export const registerProductionPlanModalModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerProductionPlanModalEvents(registrar);
    registerProductionPlanModalSubscriptions(registrar);
};
