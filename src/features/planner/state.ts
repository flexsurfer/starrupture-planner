import type { PlannerFlowDirection } from './flow-graph';
import type { CorporationLevelSelection, RecipeAlternativePreset } from '@/app/uklad/model';

export type PlannerMode = 'single' | 'multi';
export type PlannerView = 'graph' | 'table';

/** One independently saved planner document. Mode is chosen only at creation. */
export interface PlannerTab {
    id: string;
    name: string;
    mode: PlannerMode;
    selectedItemId: string | null;
    selectedCorporationLevel: CorporationLevelSelection | null;
    targetAmount: number;
    multiTargets: { itemId: string; amount: number }[];
    recipeSelections: Record<string, string>;
    groupByStage: boolean;
    flowDirection: PlannerFlowDirection;
    activeView: PlannerView;
}

export interface PlannerFeatureState {
    plannerTabs: PlannerTab[];
    plannerActiveTabId: string | null;
    plannerTabCreation: { itemId?: string; corporationLevel?: CorporationLevelSelection } | null;
    plannerTargetWarning: string | null;
    pinnedRecipeSelections: Record<string, string>;
    recipeAlternativePresets: RecipeAlternativePreset[];
}

export function createPlannerTab(id: string, name: string, mode: PlannerMode, activeView: PlannerView = 'graph'): PlannerTab {
    return {
        id, name, mode, activeView,
        selectedItemId: null,
        selectedCorporationLevel: null,
        targetAmount: 60,
        multiTargets: [],
        recipeSelections: {},
        groupByStage: false,
        flowDirection: 'LR',
    };
}

/** Also recovers gracefully if a saved active ID is missing or stale. */
export function getActivePlannerTab(state: Pick<PlannerFeatureState, 'plannerTabs' | 'plannerActiveTabId'>): PlannerTab | null {
    return state.plannerTabs.find(tab => tab.id === state.plannerActiveTabId) ?? state.plannerTabs[0] ?? null;
}

export function createPlannerFeatureState(): PlannerFeatureState {
    return {
        plannerTabs: [],
        plannerActiveTabId: null,
        plannerTabCreation: null,
        plannerTargetWarning: null,
        pinnedRecipeSelections: {},
        recipeAlternativePresets: [],
    };
}
