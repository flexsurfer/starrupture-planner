import { readBasesFromStorage } from './bases-storage';
import { readEnergyGroupsFromStorage } from './energy-groups-storage';
import { readPinnedRecipesFromStorage } from './pinned-recipes-storage';
import { readRecipePresetsFromStorage } from './recipe-presets-storage';

function seedLegacyValue(prefix: string, rootKey: string, value: unknown): void {
    if (value === null || typeof localStorage === 'undefined') return;

    const persistKey = `${prefix}/${encodeURIComponent(rootKey)}`;
    if (localStorage.getItem(persistKey) !== null) return;
    localStorage.setItem(persistKey, JSON.stringify({ v: 1, data: value }));
}

function migrateLegacyValue(prefix: string, rootKey: string, readLegacyValue: () => unknown): void {
    try {
        seedLegacyValue(prefix, rootKey, readLegacyValue());
    } catch (error) {
        console.error(`Could not migrate legacy local storage for ${rootKey}:`, error);
    }
}

/** Copies the previous per-feature storage format into Uklad's root format once. */
export function migrateLegacyStorage(prefix: string): void {
    if (typeof localStorage === 'undefined') return;

    migrateLegacyValue(prefix, 'uiTheme', () => {
        const theme = localStorage.getItem('theme');
        return theme === 'light' || theme === 'dark' ? theme : null;
    });
    migrateLegacyValue(prefix, 'appDataVersion', () => localStorage.getItem('dataVersion'));
    migrateLegacyValue(prefix, 'basesList', readBasesFromStorage);
    migrateLegacyValue(prefix, 'energyGroups', readEnergyGroupsFromStorage);
    migrateLegacyValue(prefix, 'pinnedRecipeSelections', readPinnedRecipesFromStorage);
    migrateLegacyValue(prefix, 'recipeAlternativePresets', readRecipePresetsFromStorage);
}
