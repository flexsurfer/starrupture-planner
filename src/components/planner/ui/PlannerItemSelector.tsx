import { runtime } from '@/app/uklad/bootstrap';
import { appIds } from '@/app/uklad/catalog';
import React, { useCallback } from 'react';
import { useSubscription } from '@/app/uklad/bindings';

interface PlannerItemSelectorProps {
    className?: string;
}

/**
 * Item selector dropdown for the production planner
 */
export const PlannerItemSelector: React.FC<PlannerItemSelectorProps> = ({ className = '' }) => {
    const selectedItemId = useSubscription([appIds.subscriptions.PLANNER_SELECTED_ITEM_ID]);
    const selectableItems = useSubscription([appIds.subscriptions.PLANNER_SELECTABLE_ITEMS]);

    const onItemSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const itemId = event.target.value;
        runtime.dispatch([appIds.events.PLANNER_SET_SELECTED_ITEM, itemId || null]);
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
