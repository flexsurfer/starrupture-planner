import React from 'react';
import { usePlannerSelectableItems } from './hooks';

interface PlannerItemSelectorProps {
    selectedItemId: string;
    onItemSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    className?: string;
}

/**
 * Item selector dropdown for the production planner
 */
export const PlannerItemSelector: React.FC<PlannerItemSelectorProps> = ({
    selectedItemId,
    onItemSelect,
    className = ''
}) => {
    const selectableItems = usePlannerSelectableItems();

    return (
        <select
            className={`select select-bordered ${className}`}
            value={selectedItemId}
            onChange={onItemSelect}
        >
            <option value="">Choose an item...</option>
            {selectableItems.map((item) => (
                <option key={item.id} value={item.id}>
                    {item.name} ({item.type})
                </option>
            ))}
        </select>
    );
};
