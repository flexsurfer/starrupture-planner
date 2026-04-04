import React from 'react';
import { dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import { EVENT_IDS } from '../../../../../state/event-ids';
import { RecipeAlternativesDropdown } from '../../../../planner/ui/RecipeAlternativesDropdown';

export const RecipeAlternativesSelector: React.FC = () => (
    <RecipeAlternativesDropdown
        optionsSubId={SUB_IDS.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS}
        onSelectRecipe={(itemId, optionKey) => {
            dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, itemId, optionKey]);
        }}
    />
);
