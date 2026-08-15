import { appIds } from '@/app/uklad/catalog';
import React, { useEffect, useRef, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Item, RecipeAlternativePreset } from '@/app/uklad/model';
import type { PlannerRecipeOptionsItem } from '../core/types';
import { ItemImage, BuildingImage } from '../../ui';

const EMPTY_ITEMS_BY_ID: Record<string, Item> = {};
const EMPTY_PINNED_SELECTIONS: Record<string, string> = {};
const EMPTY_PRESETS: RecipeAlternativePreset[] = [];

/** True when two `itemId -> recipeKey` maps hold exactly the same entries. */
function sameSelections(a: Record<string, string>, b: Record<string, string>): boolean {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    return aKeys.every((key) => a[key] === b[key]);
}

export interface RecipeAlternativesDropdownProps {
    options: PlannerRecipeOptionsItem[];
    onSelectRecipe: (itemId: string, optionKey: string) => void;
    /** Replaces the whole current selection at once (used when loading a saved set). */
    onApplySelections?: (selections: Record<string, string>) => void;
    className?: string;
    showChevron?: boolean;
    panelMaxHeightClass?: string;
}

/**
 * Dropdown for choosing per-output recipe alternatives (buildings/rates).
 * Used by the main planner and the production plan modal with different subs/events.
 *
 * The panel header exposes set-level controls: save the current alternatives as a
 * named set, load a saved set, and make the current alternatives the default for
 * new plans. Saved sets and the default are global and persisted.
 */
export const RecipeAlternativesDropdown: React.FC<RecipeAlternativesDropdownProps> = ({
    options,
    onSelectRecipe,
    onApplySelections,
    className = '',
    showChevron = false,
    panelMaxHeightClass = 'max-h-[60vh]'
}) => {
    const runtime = useRuntime();
    const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]) ?? EMPTY_ITEMS_BY_ID;
    const defaultSelections = useSubscription([appIds.subscriptions.PINNED_RECIPE_SELECTIONS]) ?? EMPTY_PINNED_SELECTIONS;
    const presets = useSubscription([appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS]) ?? EMPTY_PRESETS;
    const [isOpen, setIsOpen] = useState(false);
    const [isLoadOpen, setIsLoadOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const onMouseDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsLoadOpen(false);
            }
        };

        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [isOpen]);

    if (!options.length) return null;

    const total = options.length;
    const selectedNonDefault = options.filter((entry) => entry.selectedKey !== entry.defaultKey).length;

    const normalizedOptions = options.map((entry) => {
        const selectedOption = entry.options.find((option) => option.key === entry.selectedKey) ?? entry.options[0]!;
        return { entry, selectedOption };
    });

    // The current alternatives = non-default overrides among the items on screen.
    const currentSelections: Record<string, string> = {};
    for (const entry of options) {
        if (entry.selectedKey && entry.selectedKey !== entry.defaultKey) {
            currentSelections[entry.itemId] = entry.selectedKey;
        }
    }
    const hasCustomSelection = Object.keys(currentSelections).length > 0;
    const isCurrentDefault =
        Object.keys(defaultSelections).length > 0 && sameSelections(currentSelections, defaultSelections);

    const handleSavePreset = () => {
        const name = window.prompt('Save current alternatives as:');
        if (name && name.trim()) {
            runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, name.trim(), currentSelections]);
        }
    };

    const handleToggleDefault = () => {
        runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS, isCurrentDefault ? {} : currentSelections]);
    };

    const handleLoadPreset = (preset: RecipeAlternativePreset) => {
        onApplySelections?.({ ...preset.selections });
        setIsLoadOpen(false);
    };

    const handleDeletePreset = (event: React.MouseEvent, presetId: string) => {
        event.stopPropagation();
        runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, presetId]);
    };

    return (
        <div ref={rootRef} className={`relative ${className}`.trim()}>
            <button
                type="button"
                className="btn btn-sm btn-ghost gap-2 border border-base-300 bg-transparent hover:bg-base-200"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className="text-xs font-semibold">Alternatives</span>
                {showChevron ? (
                    <span className="flex items-center gap-2">
                        <span className="text-xs">
                            {selectedNonDefault}/{total}
                        </span>
                        <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                    </span>
                ) : (
                    <span className="text-xs">
                        {selectedNonDefault}/{total}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className={`absolute right-0 mt-2 z-30 w-[min(92vw,560px)] ${panelMaxHeightClass} overflow-y-auto rounded-md border border-base-300 bg-base-100 p-2 shadow-xl`}
                >
                    <div className="sticky -top-2 z-10 -mx-2 -mt-2 mb-2 border-b border-base-300 bg-base-100 px-3 pt-2 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-base-content/80 mr-auto">Recipe Alternatives</span>

                            <button
                                type="button"
                                className="btn btn-xs btn-ghost border border-base-300"
                                disabled={!hasCustomSelection}
                                title="Save the current alternatives as a named set"
                                onClick={handleSavePreset}
                            >
                                Save set
                            </button>

                            <div className="relative">
                                <button
                                    type="button"
                                    className="btn btn-xs btn-ghost border border-base-300 gap-1"
                                    disabled={!presets.length || !onApplySelections}
                                    title="Load a saved set of alternatives"
                                    onClick={() => setIsLoadOpen((prev) => !prev)}
                                >
                                    Load set
                                    <span className="opacity-70">({presets.length})</span>
                                    <span className="text-[10px]">▼</span>
                                </button>

                                {isLoadOpen && presets.length > 0 && (
                                    <div className="absolute right-0 mt-1 z-40 w-56 max-h-60 overflow-y-auto rounded-md border border-base-300 bg-base-100 p-1 shadow-xl">
                                        {presets.map((preset) => (
                                            <div
                                                key={preset.id}
                                                role="button"
                                                tabIndex={0}
                                                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-base-200 cursor-pointer"
                                                onClick={() => handleLoadPreset(preset)}
                                            >
                                                <span className="text-xs truncate flex-1" title={preset.name}>
                                                    {preset.name}
                                                </span>
                                                <span className="text-[10px] text-base-content/50">
                                                    {Object.keys(preset.selections).length}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs px-1 text-error/80 hover:text-error"
                                                    title={`Delete "${preset.name}"`}
                                                    onClick={(event) => handleDeletePreset(event, preset.id)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                className={`btn btn-xs gap-1 ${isCurrentDefault ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                                title={
                                    isCurrentDefault
                                        ? 'These alternatives are the default for new plans — click to clear'
                                        : 'Use the current alternatives as the default for new plans'
                                }
                                onClick={handleToggleDefault}
                            >
                                {isCurrentDefault ? 'Default ✓' : 'Set as default'}
                            </button>
                        </div>
                        <div className="mt-1 text-[11px] leading-snug text-base-content/60">
                            Save and load named sets of alternatives, or make the current set the default
                            machines pre-selected for every new plan.
                        </div>
                    </div>

                    {normalizedOptions.map(({ entry, selectedOption }) => (
                        <div key={entry.itemId} className="rounded-md border border-base-300 bg-base-200/40 p-2 mb-2 last:mb-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                                <div className="flex items-start gap-2 min-w-0" title={`Selected building: ${selectedOption.buildingName}`}>
                                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                        <div className="badge badge-success badge-xs font-medium">
                                            {selectedOption.outputRate}/min
                                        </div>
                                        <ItemImage itemId={entry.itemId} item={itemsById[entry.itemId]} size="medium" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium truncate">{entry.itemName}</div>
                                    </div>
                                </div>

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
                                                    onClick={() => onSelectRecipe(entry.itemId, option.key)}
                                                >
                                                    <div
                                                        className={`absolute -top-1 -right-1 badge badge-xs font-medium ${
                                                            isSelected ? 'badge-primary' : 'badge-neutral'
                                                        }`}
                                                    >
                                                        {option.outputRate}/min
                                                    </div>
                                                    <BuildingImage buildingId={option.buildingId} size="medium" />
                                                </button>
                                                <div
                                                    className="text-[10px] leading-tight w-16 text-center break-words"
                                                    title={option.buildingName}
                                                >
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
