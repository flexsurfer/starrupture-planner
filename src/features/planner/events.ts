import { getMultiTargetWarning } from './target-conflicts';
import { createRecipeResolver } from './production-flow';
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

function validateTargets(state: AppState, ids: string[], selections = state.plannerMultiRecipeSelections): boolean {
    state.plannerTargetWarning = getMultiTargetWarning(ids, state.buildingsList, selections, state.itemsList);
    return state.plannerTargetWarning === null;
}

export const registerPlannerEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.PLANNER_SET_GROUP_BY_STAGE, ({ draftState }, enabled) => {
        draftState.plannerGroupByStage = enabled;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_FLOW_DIRECTION, ({ draftState }, direction) => {
        if (['LR', 'RL', 'TB', 'BT'].includes(direction)) draftState.plannerFlowDirection = direction;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_MODE, ({ draftState }, mode) => {
        // Keep an invalid plan accessible so its targets and recipes can be repaired.
        draftState.plannerMode = mode;
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_DISMISS_TARGET_WARNING, ({ draftState }) => {
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_ADD_TARGET, ({ draftState }, itemId) => {
        if (draftState.plannerMultiTargets.some(target => target.itemId === itemId)) {
            draftState.plannerTargetWarning = 'This item is already a target.';
            return;
        }
        // The first successful addition starts a fresh plan with the saved defaults.
        // Subsequent additions and mode switches retain this plan's overrides.
        const selections = draftState.plannerMultiTargets.length === 0
            ? { ...draftState.pinnedRecipeSelections }
            : draftState.plannerMultiRecipeSelections;
        const info = createRecipeResolver(draftState.buildingsList, selections)(itemId);
        if (!info?.recipe.inputs.length) return;
        if (!validateTargets(draftState as AppState, [...draftState.plannerMultiTargets.map(t => t.itemId), itemId], selections)) return;
        draftState.plannerMultiRecipeSelections = selections;
        draftState.plannerMultiTargets.push({ itemId, amount: info.recipe.output.amount_per_minute });
    });
    registrar.regEvent(appIds.events.PLANNER_REMOVE_TARGET, ({ draftState }, itemId) => {
        draftState.plannerMultiTargets = draftState.plannerMultiTargets.filter(t => t.itemId !== itemId);
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, ({ draftState }, itemId, amount) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const target = draftState.plannerMultiTargets.find(t => t.itemId === itemId);
        if (target) target.amount = amount;
    });
    registrar.regEvent(appIds.events.PLANNER_OPEN_ITEM, ({ draftState }, itemId, corporationLevel) => {
        draftState.plannerMode = 'single';
        draftState.plannerTargetWarning = null;
        draftState.plannerSelectedItemId = itemId;
        draftState.plannerSelectedCorporationLevel = corporationLevel || null;
        draftState.plannerRecipeSelections = { ...draftState.pinnedRecipeSelections };
        draftState.uiActiveTab = 'planner';
        setTargetAmountToDefault(draftState as AppState, itemId);
    });

    registrar.regEvent(appIds.events.PLANNER_SET_SELECTED_ITEM, ({ draftState }, itemId) => {
        draftState.plannerMode = 'single';
        draftState.plannerTargetWarning = null;
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
        const selections = { ...(draftState.plannerMode === 'multi' ? draftState.plannerMultiRecipeSelections : draftState.plannerRecipeSelections) };
        if (recipeKey) selections[itemId] = recipeKey;
        else delete selections[itemId];
        if (draftState.plannerMode === 'multi' && !validateTargets(draftState as AppState, draftState.plannerMultiTargets.map(t => t.itemId), selections)) return;
        if (draftState.plannerMode === 'multi') draftState.plannerMultiRecipeSelections = selections;
        else draftState.plannerRecipeSelections = selections;
    });

    registrar.regEvent(appIds.events.PLANNER_SET_RECIPE_SELECTIONS, ({ draftState }, selections) => {
        if (draftState.plannerMode === 'multi' && !validateTargets(draftState as AppState, draftState.plannerMultiTargets.map(t => t.itemId), selections || {})) return;
        if (draftState.plannerMode === 'multi') draftState.plannerMultiRecipeSelections = { ...(selections || {}) };
        else draftState.plannerRecipeSelections = { ...(selections || {}) };
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
