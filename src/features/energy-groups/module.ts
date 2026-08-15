import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerEnergyGroupsEvents } from './events';
import { registerEnergyGroupsSubscriptions } from './subscriptions';

export const registerEnergyGroupsModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerEnergyGroupsEvents(registrar);
    registerEnergyGroupsSubscriptions(registrar);
};
