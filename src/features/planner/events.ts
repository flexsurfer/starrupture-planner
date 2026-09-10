import { createPlannerTab, getActivePlannerTab, type PlannerTab } from './state';
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

function createRecipeAlternativePresetId(): string {
    return `rap_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function validateTargets(state: AppState, tab: PlannerTab, ids: string[], selections = tab.recipeSelections): boolean {
    state.plannerTargetWarning = getMultiTargetWarning(ids, state.buildingsList, selections, state.itemsList);
    return state.plannerTargetWarning === null;
}

export const registerPlannerEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.PLANNER_REQUEST_TAB_CREATION, ({ draftState }) => {
        draftState.plannerTabCreation = {};
    });
    registrar.regEvent(appIds.events.PLANNER_CANCEL_TAB_CREATION, ({ draftState }) => {
        draftState.plannerTabCreation = null;
    });
    registrar.regEvent(appIds.events.PLANNER_CREATE_TAB, ({ draftState }, id, name, mode, view = 'graph') => {
        const trimmedName = name.trim();
        if (!id.trim() || !trimmedName || !['single', 'multi'].includes(mode)
            || !['graph', 'table'].includes(view) || draftState.plannerTabs.some(tab => tab.id === id)) return;
        const tab = createPlannerTab(id, trimmedName, mode, view);
        tab.recipeSelections = { ...draftState.pinnedRecipeSelections };
        const request = draftState.plannerTabCreation;
        if (request?.itemId) {
            if (mode === 'single') {
                tab.selectedItemId = request.itemId;
                tab.selectedCorporationLevel = request.corporationLevel ? { ...request.corporationLevel } : null;
                tab.targetAmount = getSlowestOutputRateForItem(draftState.buildingsList, request.itemId);
            } else {
                const info = createRecipeResolver(draftState.buildingsList, tab.recipeSelections)(request.itemId);
                if (info?.recipe.inputs.length) {
                    tab.multiTargets = [{ itemId: request.itemId, amount: info.recipe.output.amount_per_minute }];
                }
            }
        }
        draftState.plannerTabs.push(tab);
        draftState.plannerActiveTabId = id;
        draftState.plannerTabCreation = null;
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_SELECT_TAB, ({ draftState }, id) => {
        if (!draftState.plannerTabs.some(tab => tab.id === id)) return;
        draftState.plannerActiveTabId = id;
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_CLOSE_TAB, ({ draftState }, id) => {
        const index = draftState.plannerTabs.findIndex(tab => tab.id === id);
        if (index < 0) return;
        const activeId = getActivePlannerTab(draftState)?.id;
        draftState.plannerTabs.splice(index, 1);
        if (id === activeId) {
            draftState.plannerActiveTabId = draftState.plannerTabs[Math.min(index, draftState.plannerTabs.length - 1)]?.id ?? null;
            draftState.plannerTargetWarning = null;
        }
    });
    registrar.regEvent(appIds.events.PLANNER_SET_ACTIVE_VIEW, ({ draftState }, view) => {
        const tab = getActivePlannerTab(draftState);
        if (tab && ['graph', 'table'].includes(view)) tab.activeView = view;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_GROUP_BY_STAGE, ({ draftState }, enabled) => {
        const tab = getActivePlannerTab(draftState);
        if (tab) tab.groupByStage = enabled;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_FLOW_DIRECTION, ({ draftState }, direction) => {
        const tab = getActivePlannerTab(draftState);
        if (tab && ['LR', 'RL', 'TB', 'BT'].includes(direction)) tab.flowDirection = direction;
    });
    registrar.regEvent(appIds.events.PLANNER_DISMISS_TARGET_WARNING, ({ draftState }) => {
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_ADD_TARGET, ({ draftState }, itemId) => {
        const tab = getActivePlannerTab(draftState);
        if (tab?.mode !== 'multi') return;
        if (tab.multiTargets.some(target => target.itemId === itemId)) {
            draftState.plannerTargetWarning = 'This item is already a target.';
            return;
        }
        const info = createRecipeResolver(draftState.buildingsList, tab.recipeSelections)(itemId);
        if (!info?.recipe.inputs.length) return;
        if (!validateTargets(draftState, tab, [...tab.multiTargets.map(t => t.itemId), itemId])) return;
        tab.multiTargets.push({ itemId, amount: info.recipe.output.amount_per_minute });
    });
    registrar.regEvent(appIds.events.PLANNER_REMOVE_TARGET, ({ draftState }, itemId) => {
        const tab = getActivePlannerTab(draftState);
        if (tab?.mode !== 'multi') return;
        tab.multiTargets = tab.multiTargets.filter(t => t.itemId !== itemId);
        draftState.plannerTargetWarning = null;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, ({ draftState }, itemId, amount) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const tab = getActivePlannerTab(draftState);
        if (tab?.mode !== 'multi') return;
        const target = tab.multiTargets.find(t => t.itemId === itemId);
        if (target) target.amount = amount;
    });
    registrar.regEvent(appIds.events.PLANNER_OPEN_ITEM, ({ draftState }, itemId, corporationLevel) => {
        draftState.plannerTabCreation = { itemId, ...(corporationLevel ? { corporationLevel: { ...corporationLevel } } : {}) };
        draftState.uiActiveTab = 'planner';
    });
    registrar.regEvent(appIds.events.PLANNER_SET_SELECTED_ITEM, ({ draftState }, itemId) => {
        const tab = getActivePlannerTab(draftState);
        if (tab?.mode !== 'single') return;
        draftState.plannerTargetWarning = null;
        tab.selectedItemId = itemId;
        tab.selectedCorporationLevel = null;
        tab.targetAmount = getSlowestOutputRateForItem(draftState.buildingsList, itemId || '');
    });
    registrar.regEvent(appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL, ({ draftState }, corporationLevel) => {
        const tab = getActivePlannerTab(draftState);
        if (tab?.mode === 'single') tab.selectedCorporationLevel = corporationLevel ? { ...corporationLevel } : null;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_RECIPE_SELECTION, ({ draftState }, itemId, recipeKey) => {
        const tab = getActivePlannerTab(draftState);
        if (!tab || !itemId) return;
        const selections = { ...tab.recipeSelections };
        if (recipeKey) selections[itemId] = recipeKey;
        else delete selections[itemId];
        if (tab.mode === 'multi' && !validateTargets(draftState, tab, tab.multiTargets.map(t => t.itemId), selections)) return;
        tab.recipeSelections = selections;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_RECIPE_SELECTIONS, ({ draftState }, selections) => {
        const tab = getActivePlannerTab(draftState);
        if (!tab) return;
        if (tab.mode === 'multi' && !validateTargets(draftState, tab, tab.multiTargets.map(t => t.itemId), selections || {})) return;
        tab.recipeSelections = { ...(selections || {}) };
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
        const tab = getActivePlannerTab(draftState);
        if (tab?.mode === 'single' && Number.isFinite(targetAmount) && targetAmount > 0) tab.targetAmount = targetAmount;
    });
};
