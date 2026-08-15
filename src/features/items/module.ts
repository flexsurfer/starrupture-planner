import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerItemsEvents } from './events';
import { registerItemsSubscriptions } from './subscriptions';

export const registerItemsModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerItemsEvents(registrar);
    registerItemsSubscriptions(registrar);
};
