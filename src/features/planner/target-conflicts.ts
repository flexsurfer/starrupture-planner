import type { Building, Item } from './types';
import { createRecipeResolver } from './production-flow';

/** Structural check: independent of rates, rounding, or available external inputs. */
export function findTargetConflict(
    targetIds: string[],
    buildings: Building[],
    recipeSelections: Record<string, string>,
): { target: string; ingredient: string } | null {
    return findConflict(targetIds, createRecipeResolver(buildings, recipeSelections));
}

function findConflict(
    targetIds: string[],
    getRecipe: ReturnType<typeof createRecipeResolver>,
): { target: string; ingredient: string } | null {
    const targets = new Set(targetIds);
    for (const target of targets) {
        const visited = new Set<string>([target]);
        const pending = [...(getRecipe(target)?.recipe.inputs ?? [])].map(input => input.id);
        while (pending.length) {
            const ingredient = pending.pop()!;
            if (ingredient !== target && targets.has(ingredient)) return { target, ingredient };
            if (visited.has(ingredient)) continue;
            visited.add(ingredient);
            pending.push(...(getRecipe(ingredient)?.recipe.inputs ?? []).map(input => input.id));
        }
    }
    return null;
}

/** Validate against the current recipes, including fallback after a recipe is removed. */
export function getMultiTargetWarning(
    targetIds: string[],
    buildings: Building[],
    recipeSelections: Record<string, string>,
    items: Item[],
): string | null {
    if (!targetIds.length) return null;
    const getRecipe = createRecipeResolver(buildings, recipeSelections);
    const name = (id: string) => items.find(item => item.id === id)?.name ?? id;
    for (const itemId of targetIds) {
        const recipe = getRecipe(itemId)?.recipe;
        if (!recipe?.inputs.length || !Number.isFinite(recipe.output.amount_per_minute)
            || recipe.output.amount_per_minute <= 0) {
            return `${name(itemId)} has no usable production recipe in the current game data.`;
        }
    }
    const conflict = findConflict(targetIds, getRecipe);
    return conflict
        ? `${name(conflict.ingredient)} is required to produce ${name(conflict.target)}. Targets cannot be ingredients of other targets.`
        : null;
}
