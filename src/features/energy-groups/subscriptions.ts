import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerEnergyGroupsSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.ENERGY_GROUPS_LIST, stateKeys.energyGroups);
};
