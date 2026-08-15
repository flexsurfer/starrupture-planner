import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerPlannerSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.PLANNER_SELECTED_ITEM_ID, stateKeys.plannerSelectedItemId);
    registrar.regRootSub(appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL, stateKeys.plannerSelectedCorporationLevel);
    registrar.regRootSub(appIds.subscriptions.PLANNER_RECIPE_SELECTIONS, stateKeys.plannerRecipeSelections);
    registrar.regRootSub(appIds.subscriptions.PINNED_RECIPE_SELECTIONS, stateKeys.pinnedRecipeSelections);
    registrar.regRootSub(appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS, stateKeys.recipeAlternativePresets);
    registrar.regRootSub(appIds.subscriptions.PLANNER_TARGET_AMOUNT, stateKeys.plannerTargetAmount);
};
