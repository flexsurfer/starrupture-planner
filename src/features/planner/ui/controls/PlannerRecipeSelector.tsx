import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { RecipeAlternativesDropdown } from './RecipeAlternativesDropdown';

interface PlannerRecipeSelectorProps {
    className?: string;
}

/**
 * Planner recipe selector for per-item alternative recipes.
 * Defaults to the slowest primary recipe and keeps explicit alternatives opt-in.
 */
export const PlannerRecipeSelector: React.FC<PlannerRecipeSelectorProps> = ({ className = '' }) => {
    const runtime = useRuntime();
    const options = useSubscription([appIds.subscriptions.PLANNER_RECIPE_OPTIONS]);

    return <RecipeAlternativesDropdown
        options={options}
        onSelectRecipe={(itemId, optionKey) => {
            runtime.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, itemId, optionKey]);
        }}
        onApplySelections={(selections) => {
            runtime.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTIONS, selections]);
        }}
        className={className}
        showChevron
        panelMaxHeightClass="max-h-[65vh]"
    />;
};
