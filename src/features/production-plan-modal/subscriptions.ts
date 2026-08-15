import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerProductionPlanModalSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE, stateKeys.productionPlanModalState);

    registrar.regSub(
        appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE,
        () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]],
        ([modalState], ..._params) => {
            void _params;
            return { isOpen: modalState.isOpen };
        },
    );

    registrar.regSub(
        appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA,
        () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]],
        ([modalState], ..._params) => {
            void _params;
            return { isEditMode: !!modalState.editSectionId };
        },
    );

    registrar.regSub(
        appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES,
        () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE], [appIds.subscriptions.ITEMS_LIST]],
        ([modalState, items], ..._params) => {
            void _params;
            const selectedItemName = modalState.selectedItemId
                ? items.find((item) => item.id === modalState.selectedItemId)?.name || ''
                : '';
            return {
                defaultName: modalState.name,
                currentSelectedItemId: modalState.selectedItemId,
                currentTargetAmount: modalState.targetAmount,
                defaultSelectedCorporationLevel: modalState.selectedCorporationLevel,
                selectedItemName,
                matchInputs: modalState.matchInputs,
            };
        },
    );
};
