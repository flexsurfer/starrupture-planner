import React, { useCallback } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { Item } from '../core/types';

interface PlannerItemSelectorProps {
    className?: string;
}

/**
 * Item selector dropdown for the production planner
 */
export const PlannerItemSelector: React.FC<PlannerItemSelectorProps> = ({ className = '' }) => {
    const selectedItemId = useSubscription<string | null>([SUB_IDS.SELECTED_PLANNER_ITEM]);
    const selectableItems = useSubscription<Item[]>([SUB_IDS.PLANNER_SELECTABLE_ITEMS]);

    const onItemSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const itemId = event.target.value;
        dispatch([EVENT_IDS.SET_PLANNER_ITEM, itemId || null]);
    }, []);

    return (
        <select
            className={`select select-bordered ${className}`}
            value={selectedItemId || ''}
            onChange={onItemSelect}
        >
            <option value="">Choose an item...</option>
            {selectableItems.map((item) => (
                <option key={item.id} value={item.id}>
                    {item.name}
                </option>
            ))}
        </select>
    );
};
