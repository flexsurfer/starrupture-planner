import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { AppState, Building, RecipeAlternativePreset } from '@/app/uklad/model';

/** Slowest output rate for an item, matching the production-flow default. */
function getSlowestOutputRateForItem(buildings: Building[], itemId: string): number {
    let bestRate: number | null = null;
    for (const building of buildings) {
        for (const recipe of building.recipes || []) {
            if (recipe.output.id === itemId) {
                const rate = recipe.output.amount_per_minute;
                if (bestRate === null || rate < bestRate) bestRate = rate;
            }
        }
    }
    return bestRate ?? 60;
}

function setTargetAmountToDefault(draftState: AppState, itemId: string): void {
    draftState.plannerTargetAmount = getSlowestOutputRateForItem(draftState.buildingsList, itemId);
}

function createRecipeAlternativePresetId(): string {
    return `rap_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const registerPlannerEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.PLANNER_OPEN_ITEM, ({ draftState }, itemId, corporationLevel) => {
        draftState.plannerSelectedItemId = itemId;
        draftState.plannerSelectedCorporationLevel = corporationLevel || null;
        draftState.plannerRecipeSelections = { ...draftState.pinnedRecipeSelections };
        draftState.uiActiveTab = 'planner';
        setTargetAmountToDefault(draftState as AppState, itemId);
    });

    registrar.regEvent(appIds.events.PLANNER_SET_SELECTED_ITEM, ({ draftState }, itemId) => {
        draftState.plannerSelectedItemId = itemId;
        draftState.plannerSelectedCorporationLevel = null;
        draftState.plannerRecipeSelections = { ...draftState.pinnedRecipeSelections };
        setTargetAmountToDefault(draftState as AppState, itemId || '');
    });

    registrar.regEvent(appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL, ({ draftState }, corporationLevel) => {
        draftState.plannerSelectedCorporationLevel = corporationLevel;
    });

    registrar.regEvent(appIds.events.PLANNER_SET_RECIPE_SELECTION, ({ draftState }, itemId, recipeKey) => {
        if (!itemId) return;
        if (!recipeKey) {
            delete draftState.plannerRecipeSelections[itemId];
            return;
        }
        draftState.plannerRecipeSelections[itemId] = recipeKey;
    });

    registrar.regEvent(appIds.events.PLANNER_SET_RECIPE_SELECTIONS, ({ draftState }, selections) => {
        draftState.plannerRecipeSelections = { ...(selections || {}) };
    });

    registrar.regEvent(appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS, ({ draftState }, selections) => {
        draftState.pinnedRecipeSelections = { ...(selections || {}) };
    });

    registrar.regEvent(appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, ({ draftState }, name, selections) => {
        const trimmedName = (name || '').trim().replace(/\s+/g, ' ');
        if (!trimmedName) return;

        const presetSelections = { ...(selections || {}) };
        const existing = draftState.recipeAlternativePresets.find(
            (preset: RecipeAlternativePreset) => preset.name.toLowerCase() === trimmedName.toLowerCase(),
        );
        if (existing) {
            existing.selections = presetSelections;
            return;
        }

        draftState.recipeAlternativePresets.push({
            id: createRecipeAlternativePresetId(),
            name: trimmedName,
            selections: presetSelections,
        });
    });

    registrar.regEvent(appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, ({ draftState }, presetId) => {
        if (!presetId) return;
        draftState.recipeAlternativePresets = draftState.recipeAlternativePresets.filter(
            (preset: RecipeAlternativePreset) => preset.id !== presetId,
        );
    });

    registrar.regEvent(appIds.events.PLANNER_SET_TARGET_AMOUNT, ({ draftState }, targetAmount) => {
        draftState.plannerTargetAmount = targetAmount;
    });
};
