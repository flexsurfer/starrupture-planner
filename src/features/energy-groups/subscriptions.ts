import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { EnergyGroup } from '@/state/db';

export const registerEnergyGroupsSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.ENERGY_GROUPS_LIST, stateKeys.energyGroups);

    registrar.regSub(
        appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP,
        () => [[appIds.subscriptions.ENERGY_GROUPS_LIST]],
        ([groups], ..._params) => {
            void _params;
            const byId: Record<string, EnergyGroup> = {};
            for (const group of groups) byId[group.id] = group;
            return byId;
        },
    );
};
