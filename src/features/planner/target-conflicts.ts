import { message, type UiMessage } from '@/shared/i18n/core';
import type { Building, Item, Recipe } from './types';
import { createRecipeResolver } from './production-flow';

/** Validate against the current recipes, including fallback after a recipe is removed. */
export function getMultiTargetWarning(
    targetIds: string[],
    buildings: Building[],
    recipeSelections: Record<string, string>,
    items: Item[],
): UiMessage | null {
    if (!targetIds.length) return null;
    const getRecipe = createRecipeResolver(buildings, recipeSelections);
    return getTargetRecipeOrder(targetIds, id => getRecipe(id)?.recipe,
        id => items.find(item => item.id === id)?.name ?? id).warning;
}

/** Ingredients precede all their consumers, including when several targets share a branch. */
export function getTargetRecipeOrder(targetIds: string[], recipeFor: (id: string) => Recipe | undefined,
    name: (id: string) => string) {
    const recipes = new Map<string, Recipe | undefined>();
    for (const itemId of targetIds) {
        const recipe = recipeFor(itemId);
        if (!recipe?.inputs.length || !Number.isFinite(recipe.output.amount_per_minute)
            || recipe.output.amount_per_minute <= 0) {
            return { recipes, warning: message('{name} has no usable production recipe in the current game data.', { name: name(itemId) }) };
        }
    }
    // A shared or targeted ingredient is valid. Only revisiting an item on the
    // current dependency path is a cycle; completed branches can be reused.
    const visiting = new Set<string>();
    const visit = (itemId: string): UiMessage | null => {
        if (visiting.has(itemId)) return message('The selected recipes contain a circular production dependency involving {name}.', { name: name(itemId) });
        if (recipes.has(itemId)) return null;
        visiting.add(itemId);
        const recipe = recipeFor(itemId);
        for (const input of recipe?.inputs ?? []) {
            const warning = visit(input.id);
            if (warning) return warning;
        }
        visiting.delete(itemId);
        recipes.set(itemId, recipe);
        return null;
    };
    for (const itemId of targetIds) {
        const warning = visit(itemId);
        if (warning) return { recipes, warning };
    }
    return { recipes, warning: null };
}
