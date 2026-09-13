import { appIds } from '@/app/uklad/catalog';
import React, { useCallback } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

interface PlannerItemSelectorProps {
    className?: string;
}

interface ItemSelectorProps extends PlannerItemSelectorProps {
    selectedItemId: string | null;
    items: readonly { id: string; name: string }[];
    onSelect: (itemId: string) => void;
}

export const ItemSelector: React.FC<ItemSelectorProps> = ({ selectedItemId, items, onSelect, className = '' }) => (
    <select
        aria-label="Production item"
        className={`select select-bordered ${className}`}
        value={selectedItemId || ''}
        onChange={(event) => onSelect(event.target.value)}
    >
        <option value="">Choose an item...</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
);

/**
 * Item selector dropdown for the production planner
 */
export const PlannerItemSelector: React.FC<PlannerItemSelectorProps> = ({ className = '' }) => {
    const runtime = useRuntime();
    const selectedItemId = useSubscription([appIds.subscriptions.PLANNER_SELECTED_ITEM_ID]);
    const selectableItems = useSubscription([appIds.subscriptions.PLANNER_SELECTABLE_ITEMS]);

    const onItemSelect = useCallback((itemId: string) => {
        runtime.dispatch([appIds.events.PLANNER_SET_SELECTED_ITEM, itemId || null]);
    }, [runtime]);

    return (
        <ItemSelector selectedItemId={selectedItemId} items={selectableItems} onSelect={onItemSelect} className={className} />
    );
};
