import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerBuildingsSubscriptions } from './subscriptions';

export const registerBuildingsModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerBuildingsSubscriptions(registrar);
};
