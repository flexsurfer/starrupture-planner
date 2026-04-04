import React from 'react';
import { dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import { RecipeAlternativesDropdown } from './RecipeAlternativesDropdown';

interface PlannerRecipeSelectorProps {
    className?: string;
}

/**
 * Planner recipe selector for per-item alternative recipes.
 * Defaults to slow-rate recipes and allows selecting alternative variants.
 */
export const PlannerRecipeSelector: React.FC<PlannerRecipeSelectorProps> = ({ className = '' }) => (
    <RecipeAlternativesDropdown
        optionsSubId={SUB_IDS.PLANNER_RECIPE_OPTIONS}
        onSelectRecipe={(itemId, optionKey) => {
            dispatch([EVENT_IDS.PLANNER_SET_RECIPE_SELECTION, itemId, optionKey]);
        }}
        className={className}
        showChevron
        panelMaxHeightClass="max-h-[65vh]"
    />
);
