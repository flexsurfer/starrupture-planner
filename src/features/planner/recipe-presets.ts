import type { Building, RecipeAlternativePreset } from '@/app/uklad/model';
import type { PlannerRecipeOptionsItem } from './types';
import type { Translator } from '@/shared/i18n/core';
import { buildRecipeOptionsForOutputItems } from './recipe-options';

export const STANDARD_RECIPE_PRESET_ID = 'rap_standard';
export const STANDARD_RECIPE_PRESET_NAME = 'Standard recipes';
export const V2_RECIPE_PRESET_ID = 'rap_v2';
export const V2_RECIPE_PRESET_NAME = 'Upgraded recipes';

export function isBuiltInRecipePreset(id: string): boolean {
    return id === STANDARD_RECIPE_PRESET_ID || id === V2_RECIPE_PRESET_ID;
}

export function createV2RecipePreset(buildings: Building[] = []): RecipeAlternativePreset {
    const outputs = new Set(buildings.flatMap(building => (building.recipes ?? []).map(recipe => recipe.output.id)));
    const selections: Record<string, string> = {};
    for (const entry of buildRecipeOptionsForOutputItems(outputs, buildings, {}, {})) {
        const upgrade = entry.options.find(option => option.recipeType === 'upgrade');
        if (upgrade && upgrade.key !== entry.defaultKey) selections[entry.itemId] = upgrade.key;
    }
    return { id: V2_RECIPE_PRESET_ID, name: V2_RECIPE_PRESET_NAME, selections };
}

export function createStandardRecipePreset(): RecipeAlternativePreset {
    return { id: STANDARD_RECIPE_PRESET_ID, name: STANDARD_RECIPE_PRESET_NAME, selections: {}, isDefault: true };
}

export function recipePresetName(preset: RecipeAlternativePreset, t: Translator): string {
    if (preset.id === STANDARD_RECIPE_PRESET_ID) return t('Standard recipes');
    if (preset.id === V2_RECIPE_PRESET_ID) return t('Upgraded recipes');
    return preset.name;
}

export interface RecipePresetState {
    selections: Record<string, string>;
    matchingPresets: RecipeAlternativePreset[];
    defaultPreset: RecipeAlternativePreset | null;
    hasDefault: boolean;
}

export function sameRecipeSelections(a: Record<string, string>, b: Record<string, string>): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}

/** Recognize defaults saved before presets had an explicit default marker. */
export function getDefaultRecipePreset(presets: RecipeAlternativePreset[], defaults: Record<string, string>): RecipeAlternativePreset | null {
    return presets.find(preset => preset.isDefault && sameRecipeSelections(preset.selections, defaults))
        ?? (Object.keys(defaults).length ? presets.find(preset => sameRecipeSelections(preset.selections, defaults)) : undefined)
        ?? null;
}

/** Upgrade old defaults without changing their recipe choices or creating duplicates on reload. */
export function initializeRecipePresets(presets: RecipeAlternativePreset[], defaults: Record<string, string>, buildings?: Building[]): RecipeAlternativePreset[] {
    const previousStandard = presets.find(preset => preset.id === STANDARD_RECIPE_PRESET_ID);
    const standard = createStandardRecipePreset();
    delete standard.isDefault;
    if (previousStandard?.isDefault) standard.isDefault = true;
    const previousV2 = presets.find(preset => preset.id === V2_RECIPE_PRESET_ID);
    const v2 = createV2RecipePreset(buildings);
    // Hydration precedes catalog loading; retain saved choices until the catalog arrives.
    if (buildings === undefined && previousV2) v2.selections = { ...previousV2.selections };
    if (previousV2?.isDefault) v2.isDefault = true;
    const initialized = [standard, v2, ...presets.filter(preset => !isBuiltInRecipePreset(preset.id)).map(preset => ({ ...preset }))];
    let selected = getDefaultRecipePreset(presets, defaults)?.id === V2_RECIPE_PRESET_ID
        ? v2 : getDefaultRecipePreset(initialized, defaults);
    if (!selected && Object.keys(defaults).length) {
        let id = 'rap_recovered_default';
        for (let suffix = 2; initialized.some(preset => preset.id === id); suffix++) id = `rap_recovered_default_${suffix}`;
        // This becomes an editable user preset name and stays stable across locale changes.
        const baseName = 'My default recipes';
        let name = baseName;
        for (let suffix = 2; initialized.some(preset => preset.name.toLowerCase() === name.toLowerCase()); suffix++) name = `${baseName} (${suffix})`;
        selected = { id, name, selections: { ...defaults } };
        initialized.push(selected);
    }
    if (!selected) selected = standard;
    for (const preset of initialized) {
        if (preset.id === selected?.id) preset.isDefault = true;
        else delete preset.isDefault;
    }
    return initialized;
}

/** Refresh catalog-derived built-ins and the default for future plans atomically. */
export function refreshRecipePresets(state: {
    recipeAlternativePresets: RecipeAlternativePreset[];
    pinnedRecipeSelections: Record<string, string>;
}, buildings?: Building[]): void {
    const initialized = initializeRecipePresets(state.recipeAlternativePresets, state.pinnedRecipeSelections, buildings);
    if (JSON.stringify(initialized) !== JSON.stringify(state.recipeAlternativePresets)) state.recipeAlternativePresets = initialized;
    const defaults = initialized.find(preset => preset.isDefault)!.selections;
    if (!sameRecipeSelections(defaults, state.pinnedRecipeSelections)) state.pinnedRecipeSelections = { ...defaults };
}

function normalizeSelections(selections: Record<string, string>, options: PlannerRecipeOptionsItem[], inputItemIds: readonly string[]): Record<string, string> {
    const normalized = { ...selections };
    for (const entry of options) {
        const selected = entry.options.find(option => option.key === selections[entry.itemId] || option.legacyKey === selections[entry.itemId]);
        if (selected?.key === entry.defaultKey) delete normalized[entry.itemId];
        else if (selected) normalized[entry.itemId] = selected.key;
    }
    for (const itemId of inputItemIds) delete normalized[itemId];
    return normalized;
}

export function buildRecipePresetState(
    presets: RecipeAlternativePreset[],
    defaults: Record<string, string>,
    selections: Record<string, string>,
    options: PlannerRecipeOptionsItem[],
    inputItemIds: readonly string[] = [],
): RecipePresetState {
    // Ignore supplied items while preserving other choices outside the current chain.
    const normalized = normalizeSelections(selections, options, inputItemIds);
    const defaultPreset = getDefaultRecipePreset(presets, defaults);
    return {
        selections: normalized,
        matchingPresets: presets.filter(preset => sameRecipeSelections(normalized, normalizeSelections(preset.selections, options, inputItemIds))),
        defaultPreset,
        hasDefault: defaultPreset !== null || Object.keys(defaults).length > 0,
    };
}
