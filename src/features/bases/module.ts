import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerBasesEvents } from './events';
import { registerBasesSubscriptions } from './subscriptions';

export const registerBasesModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerBasesEvents(registrar);
    registerBasesSubscriptions(registrar);
};
