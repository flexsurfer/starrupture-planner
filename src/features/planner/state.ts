import type { PlannerFlowDirection } from '@/features/planner/flow-graph';
import type { CorporationLevelSelection, RecipeAlternativePreset } from '@/app/uklad/model';

export interface PlannerFeatureState {
    plannerMultiRecipeSelections: Record<string, string>;
    plannerGroupByStage: boolean;
    plannerFlowDirection: PlannerFlowDirection;
    plannerMode: 'single' | 'multi';
    plannerMultiTargets: { itemId: string; amount: number }[];
    plannerTargetWarning: string | null;
    plannerSelectedItemId: string | null;
    plannerSelectedCorporationLevel: CorporationLevelSelection | null;
    plannerRecipeSelections: Record<string, string>;
    pinnedRecipeSelections: Record<string, string>;
    recipeAlternativePresets: RecipeAlternativePreset[];
    plannerTargetAmount: number;
}

/** Creates the planner's persisted selection and recipe-alternative state. */
export function createPlannerFeatureState(): PlannerFeatureState {
    return {
        plannerMultiRecipeSelections: {},
        plannerGroupByStage: false,
        plannerFlowDirection: 'LR',
        plannerMode: 'single',
        plannerMultiTargets: [],
        plannerTargetWarning: null,
        plannerSelectedItemId: null,
        plannerSelectedCorporationLevel: null,
        plannerRecipeSelections: {},
        pinnedRecipeSelections: {},
        recipeAlternativePresets: [],
        plannerTargetAmount: 60,
    };
}
