import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { registerCorporationsSubscriptions } from './subscriptions';

export const registerCorporationsModule: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registerCorporationsSubscriptions(registrar);
};
