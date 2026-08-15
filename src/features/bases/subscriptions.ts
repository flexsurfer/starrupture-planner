import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerBasesSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.BASES_LIST, stateKeys.basesList);
    registrar.regRootSub(appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS, stateKeys.basesCardCollapsedSections);
    registrar.regRootSub(appIds.subscriptions.BASES_SELECTED_BASE_ID, stateKeys.basesSelectedBaseId);
    registrar.regRootSub(appIds.subscriptions.BASES_SELECTED_DETAIL_TAB, stateKeys.basesSelectedDetailTab);
};
