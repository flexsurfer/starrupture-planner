import type { PlannerResource } from './resources';
import type { UiText } from '@/shared/i18n/core';
import type { PlannerFlowDirection } from './flow-graph';
import type { CorporationLevelSelection, RecipeAlternativePreset } from '@/app/uklad/model';
import { createStandardRecipePreset, createV2RecipePreset } from './recipe-presets';

export type PlannerMode = 'single' | 'multi';
export interface PlannerViewport { x: number; y: number; zoom: number }

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
    resources: PlannerResource[];
    groupByStage: boolean;
    flowDirection: PlannerFlowDirection;
    activeView: PlannerView;
}

export interface PlannerFeatureState {
    plannerTabs: PlannerTab[];
    /** Camera positions belong to the current runtime session, not saved plans. */
    plannerViewports: Record<string, PlannerViewport>;
    /** Retained across statistics modal openings in this runtime; never persisted. */
    plannerComparisonCoreIds: number[];
    plannerPinnedNodes: Record<string, string>;
    plannerActiveTabId: string | null;
    plannerTabCreation: { itemId?: string; corporationLevel?: CorporationLevelSelection } | null;
    plannerTargetWarning: UiText | null;
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
        resources: [],
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
        plannerViewports: {},
        plannerComparisonCoreIds: [],
        plannerPinnedNodes: {},
        plannerActiveTabId: null,
        plannerTabCreation: null,
        plannerTargetWarning: null,
        pinnedRecipeSelections: {},
        recipeAlternativePresets: [createStandardRecipePreset(), createV2RecipePreset()],
    };
}
