import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { RecipeAlternativesDropdown } from '@/features/planner/ui/controls';

export const RecipeAlternativesSelector: React.FC = () => {
    const runtime = useRuntime();
    const options = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS]);

    return <RecipeAlternativesDropdown
        options={options}
        onSelectRecipe={(itemId, optionKey) => {
            runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, itemId, optionKey]);
        }}
        onApplySelections={(selections) => {
            runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS, selections]);
        }}
    />;
};
