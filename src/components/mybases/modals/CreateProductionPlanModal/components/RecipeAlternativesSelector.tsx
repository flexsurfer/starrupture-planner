import { runtime } from '@/app/uklad/bootstrap';
import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import { RecipeAlternativesDropdown } from '../../../../planner/ui/RecipeAlternativesDropdown';

export const RecipeAlternativesSelector: React.FC = () => {
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
