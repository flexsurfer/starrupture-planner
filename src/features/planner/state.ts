import type { CorporationLevelSelection, RecipeAlternativePreset } from '@/app/uklad/model';

export interface PlannerFeatureState {
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
        plannerSelectedItemId: null,
        plannerSelectedCorporationLevel: null,
        plannerRecipeSelections: {},
        pinnedRecipeSelections: {},
        recipeAlternativePresets: [],
        plannerTargetAmount: 60,
    };
}
