import React, { useEffect, useRef, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { PlannerRecipeOptionsItem } from '../core/types';
import type { Item } from '../../../state/db';
import { ItemImage, BuildingImage } from '../../ui';

interface PlannerRecipeSelectorProps {
    className?: string;
}

/**
 * Planner recipe selector for per-item alternative recipes.
 * Defaults to slow-rate recipes and allows selecting alternative variants.
 */
export const PlannerRecipeSelector: React.FC<PlannerRecipeSelectorProps> = ({ className = '' }) => {
    const options = useSubscription<PlannerRecipeOptionsItem[]>([SUB_IDS.PLANNER_RECIPE_OPTIONS]);
    const itemsById = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_BY_ID_MAP]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const onMouseDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', onMouseDown);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [isOpen]);

    if (!options.length) return null;

    const normalizedOptions = options.map((entry) => {
        const selectedOption = entry.options.find((option) => option.key === entry.selectedKey) ?? entry.options[0]!;
        return { entry, selectedOption };
    });

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                className="btn btn-sm btn-ghost gap-2 border border-base-300 bg-transparent hover:bg-base-200"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className="text-xs font-semibold">Alternatives</span>
                <span className="flex items-center gap-2">
                    <span className="badge badge-xs badge-outline">{options.length}</span>
                    <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 z-30 w-[min(92vw,560px)] max-h-[65vh] overflow-y-auto rounded-md border border-base-300 bg-base-100 p-2 shadow-xl">
                    <div className="text-xs font-semibold text-base-content/80 mb-2 px-1">
                        Recipe Alternatives
                    </div>
                    {normalizedOptions.map(({ entry, selectedOption }) => (
                        <div key={entry.itemId} className="rounded-md border border-base-300 bg-base-200/40 p-2 mb-2 last:mb-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                                {/* Selected output component (item image + selected rate badge) */}
                                <div className="flex items-center gap-2 min-w-0" title={`Selected building: ${selectedOption.buildingName}`}>
                                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                        <div className="badge badge-success badge-xs font-medium">
                                            {selectedOption.outputRate}/min
                                        </div>
                                        <ItemImage
                                            itemId={entry.itemId}
                                            item={itemsById[entry.itemId]}
                                            size="medium"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium truncate">{entry.itemName}</div>
                                    </div>
                                </div>

                                {/* Building image choices on same line, compact width */}
                                <div className="flex items-start justify-end gap-2 flex-shrink-0">
                                    {entry.options.map((option) => {
                                        const isSelected = option.key === entry.selectedKey;

                                        return (
                                            <div key={option.key} className="flex flex-col items-center gap-1">
                                                <button
                                                    type="button"
                                                    className={`relative h-14 w-14 min-w-14 rounded-md border p-1 flex items-center justify-center transition-colors ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/10'
                                                            : 'border-base-300 bg-base-100 hover:bg-base-200'
                                                    }`}
                                                    title={`${option.buildingName} - ${option.outputRate}/min`}
                                                    onClick={() => {
                                                        dispatch([
                                                            EVENT_IDS.PLANNER_SET_RECIPE_SELECTION,
                                                            entry.itemId,
                                                            option.key
                                                        ]);
                                                    }}
                                                >
                                                    <div className={`absolute -top-1 -right-1 badge badge-xs font-medium ${isSelected ? 'badge-primary' : 'badge-neutral'}`}>
                                                        {option.outputRate}/min
                                                    </div>
                                                    <BuildingImage
                                                        buildingId={option.buildingId}
                                                        size="medium"
                                                    />
                                                </button>
                                                <div className="text-[10px] leading-tight w-16 text-center break-words" title={option.buildingName}>
                                                    {option.buildingName}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
