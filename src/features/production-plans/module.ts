import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerProductionPlansEvents } from './events';
import { registerProductionPlansSubscriptions } from './subscriptions';

export const registerProductionPlansModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerProductionPlansEvents(registrar);
    registerProductionPlansSubscriptions(registrar);
};
