import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { createProductionPlanModalFeatureState } from './state';

export const registerProductionPlanModalEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_CLOSE, ({ draftState }) => {
        draftState.productionPlanModalState = createProductionPlanModalFeatureState().productionPlanModalState;
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, ({ draftState }, name) => {
        draftState.productionPlanModalState.name = name;
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, ({ draftState }, amount) => {
        if (!draftState.productionPlanModalState.matchInputs) {
            draftState.productionPlanModalState.targetAmount = amount;
        }
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, ({ draftState }, level) => {
        draftState.productionPlanModalState.selectedCorporationLevel = level;
    });
};
