import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React, { useEffect, useId, useRef, useState } from 'react';
import { recipePresetName, type RecipePresetState } from '@/features/planner/recipe-presets';
import { ManageRecipePresetsPanel, SaveRecipePresetPanel } from './RecipePresetPanels';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Item, RecipeAlternativePreset } from '@/app/uklad/model';
import type { PlannerRecipeOptionsItem } from '@/features/planner/types';
import { BuildingImage, RecipeTypeIcon } from '@/shared/ui';
import { RecipePreview } from './RecipePreview';
import { RecipePresetIcon } from './RecipePresetIcon';
import { useDropdownViewportPosition } from '@/shared/ui/useDropdownViewportPosition';

const EMPTY_ITEMS_BY_ID: Record<string, Item> = {};
const EMPTY_PRESETS: RecipeAlternativePreset[] = [];

export interface RecipeAlternativesDropdownProps {
    options: PlannerRecipeOptionsItem[];
    presetState: RecipePresetState;
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
 * A dedicated presets section separates reusable choices from recipe editing.
 * Preset management replaces the recipe list in the same panel.
 */
export const RecipeAlternativesDropdown: React.FC<RecipeAlternativesDropdownProps> = ({
    options,
    presetState,
    onSelectRecipe,
    onApplySelections,
    className = '',
    showChevron = false,
    panelMaxHeightClass = 'max-h-[60vh]'
}) => {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]) ?? EMPTY_ITEMS_BY_ID;
    const presets = useSubscription([appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS]) ?? EMPTY_PRESETS;
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'recipes' | 'manage' | 'save'>('recipes');
    const presetsId = useId();
    const [preferredPresetId, setPreferredPresetId] = useState('');
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const manageRef = useRef<HTMLButtonElement>(null);
    const saveRef = useRef<HTMLButtonElement>(null);
    const returnFocusRef = useRef<'manage' | 'save'>('manage');
    const panelRef = useDropdownViewportPosition(isOpen && options.length > 0, rootRef);

    useEffect(() => {
        if (!isOpen || view !== 'recipes') return;
        const target = returnFocusRef.current === 'save' && !saveRef.current?.disabled ? saveRef.current : manageRef.current;
        target?.focus();
    }, [isOpen, view]);

    useEffect(() => {
        if (!isOpen) return;

        const onMouseDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setView('recipes');
            }
        };

        document.addEventListener('mousedown', onMouseDown);
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || view !== 'recipes') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [isOpen, view]);

    if (!options.length) return null;

    const total = options.length;
    const selectedNonDefault = options.filter((entry) => entry.selectedKey !== entry.defaultKey).length;

    const normalizedOptions = options.map((entry) => {
        const selectedOption = entry.options.find((option) => option.key === entry.selectedKey) ?? entry.options[0]!;
        return { entry, selectedOption };
    });

    const selectedPreset = presetState.matchingPresets.find(preset => preset.id === preferredPresetId)
        ?? presetState.matchingPresets.find(preset => preset.id === presetState.defaultPreset?.id)
        ?? presetState.matchingPresets[0];
    const closePanel = () => {
        setIsOpen(false);
        setView('recipes');
        triggerRef.current?.focus();
    };
    const handleLoadPreset = (preset: RecipeAlternativePreset) => {
        setPreferredPresetId(preset.id);
        onApplySelections?.({ ...preset.selections });
    };

    return (
        <div ref={rootRef} className={`relative ${className}`.trim()}>
            <button
                ref={triggerRef}
                type="button"
                className="btn btn-sm btn-ghost gap-2 border border-base-300 bg-transparent hover:bg-base-200"
                aria-expanded={isOpen}
                aria-label={t("Recipe alternatives: {selectedNonDefault} of {total} customized", { selectedNonDefault: selectedNonDefault, total: total })}
                title={t("Choose recipe alternatives")}
                onClick={() => { returnFocusRef.current = 'manage'; setIsOpen((prev) => !prev); setView('recipes'); }}
            >
                <span className="text-xs font-semibold">{t("Recipes")}</span>
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
                    ref={panelRef}
                    className={`fixed inset-x-2 bottom-2 z-30 flex max-sm:max-h-[85dvh] flex-col sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-[var(--dropdown-right,0px)] sm:mt-2 sm:w-[min(92vw,600px)] ${panelMaxHeightClass} rounded-xl border border-base-300 bg-base-100 shadow-xl`}
                >
                    {view === 'save' ? (
                        <SaveRecipePresetPanel
                            preset={selectedPreset}
                            presets={presets}
                            defaultPresetId={presetState.defaultPreset?.id}
                            onClose={closePanel}
                            onBack={() => setView('recipes')}
                            onSave={(name, makeDefault) => {
                                setPreferredPresetId('');
                                runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, name, { ...presetState.selections }, makeDefault]);
                                returnFocusRef.current = 'manage';
                                setView('recipes');
                            }}
                        />
                    ) : view === 'manage' ? (
                        <ManageRecipePresetsPanel
                            presets={presets}
                            defaultPresetId={presetState.defaultPreset?.id}
                            onClose={closePanel}
                            onBack={() => setView('recipes')}
                            onSetDefault={id => runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, id])}
                            onDelete={id => runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, id])}
                            onRename={(id, name) => runtime.dispatch([appIds.events.RECIPE_ALTERNATIVES_RENAME_PRESET, id, name])}
                        />
                    ) : <>
                    <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                        <h2 className="text-base font-semibold">{t('Recipe Alternatives')}</h2>
                        <button type="button" className="btn btn-xs btn-square btn-ghost size-7 min-h-7" aria-label={t('Close recipe alternatives')} onClick={closePanel}>
                            <RecipePresetIcon name="close" />
                        </button>
                    </header>

                    <section aria-labelledby={presetsId} className="mx-3 mb-3 shrink-0 rounded-lg border border-base-300 bg-base-200/50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 id={presetsId} className="flex items-center gap-2 text-sm font-medium">
                                <RecipePresetIcon name="presets" className="size-4 text-base-content/55" />
                                {t('Presets')}
                            </h3>
                            <button ref={manageRef} type="button" className="btn btn-xs h-7 min-h-7 btn-ghost gap-1.5 text-base-content/65"
                                aria-label={t('Manage presets')} onClick={() => { returnFocusRef.current = 'manage'; setView('manage'); }}>
                                <RecipePresetIcon name="manage" className="size-3.5" />
                                {t('Manage')}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative min-w-0 flex-1">
                            <select className="select select-sm select-bordered h-8 min-h-8 w-full bg-base-100 text-xs"
                                aria-label={t('Selected preset')} value={selectedPreset?.id ?? ''}
                                disabled={!presets.length || !onApplySelections}
                                onChange={event => {
                                    const preset = presets.find(entry => entry.id === event.target.value);
                                    if (preset) handleLoadPreset(preset);
                                }}>
                                {!selectedPreset && <option value="" disabled>{t('Custom recipes (unsaved)')}</option>}
                                {presets.map(preset => <option key={preset.id} value={preset.id}>
                                    {preset.id === presetState.defaultPreset?.id
                                        ? t('{name} (Default)', { name: recipePresetName(preset, t) })
                                        : recipePresetName(preset, t)}
                                </option>)}
                            </select>
                            </div>
                            <button ref={saveRef} type="button" className="btn btn-xs h-8 min-h-8 btn-primary px-3" disabled={Boolean(selectedPreset)}
                                onClick={() => { returnFocusRef.current = 'save'; setView('save'); }}>
                                {t('Save')}
                            </button>
                        </div>
                        <span className="sr-only" role="status">
                            {selectedPreset ? t('Preset: {name}', { name: recipePresetName(selectedPreset, t) }) : t('Custom recipes (unsaved)')}
                        </span>
                    </section>

                    <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
                            <h3 className="text-xs font-medium text-base-content/80">{t('Recipes')}</h3>
                            <span className="text-xs text-base-content/50">{t('Changes apply to this plan.')}</span>
                        </div>
                    {normalizedOptions.map(({ entry, selectedOption }) => (
                        <div key={entry.itemId} className="rounded-lg border border-base-300 bg-base-200/30 p-3 mb-2 last:mb-0">
                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                                <div className="min-w-0 space-y-2">
                                    <div className="text-sm font-medium">{entry.itemName}</div>
                                    <RecipePreview option={selectedOption} itemsById={itemsById} />
                                </div>

                                <div className="flex flex-wrap items-start justify-start sm:justify-end gap-x-2 gap-y-3 min-w-0">
                                    {entry.options.map((option) => {
                                        const isSelected = option.key === entry.selectedKey;

                                        return (
                                            <div
                                                key={option.key}
                                                className="relative flex flex-col items-center gap-1"
                                            >
                                                <button
                                                    type="button"
                                                    className={`relative z-10 h-14 w-14 min-w-14 rounded-md border p-1 flex items-center justify-center transition-colors ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/10'
                                                            : 'border-base-300 bg-base-100 hover:bg-base-200'
                                                    }`}
                                                    title={t("{buildingName} - {outputRate}/min", { buildingName: option.buildingName, outputRate: option.outputRate })}
                                                    aria-pressed={isSelected}
                                                    onClick={() => onSelectRecipe(entry.itemId, option.key)}
                                                >
                                                    <div
                                                        className={`absolute -top-1 -right-1 badge badge-xs font-medium ${
                                                            isSelected ? 'badge-primary' : 'badge-neutral'
                                                        }`}
                                                    >{t("{outputRate}/min", { outputRate: option.outputRate })}</div>
                                                    <RecipeTypeIcon
                                                        recipeType={option.recipeType}
                                                        className="absolute -bottom-1 -left-1"
                                                    />
                                                    <BuildingImage buildingId={option.buildingId} size="medium" />
                                                </button>
                                                <div
                                                    className="text-[11px] leading-tight w-16 text-center break-words"
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
                    </>}
                </div>
            )}
        </div>
    );
};
