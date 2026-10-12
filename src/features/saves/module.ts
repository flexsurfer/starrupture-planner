import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerSavesEvents } from './events';
import { registerSavesSubscriptions } from './subscriptions';

export const registerSavesModule: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registerSavesSubscriptions(registrar);
    registerSavesEvents(registrar);
};
