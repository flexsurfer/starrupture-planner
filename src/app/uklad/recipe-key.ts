import type { Recipe } from './model';

const RECIPE_KEY_TOKEN_PATTERN = /^[^:\s]+$/;

/** Builds the persisted selection key, preferring a stable recipe ID when available. */
export function getRecipeSelectionKey(buildingId: string, recipe: Recipe, recipeIndex: number): string {
    return `${buildingId}:${recipe.id || recipeIndex}`;
}

/** Builds the index-based key used by data versions that predate recipe IDs. */
export function getLegacyRecipeSelectionKey(buildingId: string, recipeIndex: number): string {
    return `${buildingId}:${recipeIndex}`;
}

/** Matches both a recipe's stable key and its legacy index alias. */
export function matchesRecipeSelectionKey(
    selectedKey: string,
    buildingId: string,
    recipe: Recipe,
    recipeIndex: number,
): boolean {
    return selectedKey === getRecipeSelectionKey(buildingId, recipe, recipeIndex)
        || selectedKey === getLegacyRecipeSelectionKey(buildingId, recipeIndex);
}

/** Accepts both legacy index keys and stable ID keys. */
export function isRecipeSelectionKey(value: string): boolean {
    const [buildingId, recipeIdOrIndex, ...extraParts] = value.split(':');
    return extraParts.length === 0
        && RECIPE_KEY_TOKEN_PATTERN.test(buildingId ?? '')
        && RECIPE_KEY_TOKEN_PATTERN.test(recipeIdOrIndex ?? '');
}
