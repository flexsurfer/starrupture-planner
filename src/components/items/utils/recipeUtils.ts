import type { Recipe, Building } from '../../../state/db';

export interface ItemRecipe {
  recipe: Recipe;
  building: Building;
}

/** Same ordering as production-flow default: slowest rate first, then building name. */
function compareItemRecipesForDefaultPick(a: ItemRecipe, b: ItemRecipe): number {
  const rateDiff = a.recipe.output.amount_per_minute - b.recipe.output.amount_per_minute;
  if (rateDiff !== 0) return rateDiff;
  return a.building.name.localeCompare(b.building.name);
}

/**
 * Find all recipes/buildings that produce a given item.
 */
export const findItemRecipes = (
  itemId: string, 
  buildings: Building[]
): ItemRecipe[] => {
  const results: ItemRecipe[] = [];

  for (const building of buildings) {
    for (const recipe of building.recipes || []) {
      if (recipe.output.id === itemId) {
        results.push({
          recipe,
          building
        });
      }
    }
  }

  return results.sort(compareItemRecipesForDefaultPick);
};

export const findItemRecipe = (
  itemId: string,
  buildings: Building[]
): ItemRecipe | null => {
  let best: ItemRecipe | null = null;
  for (const building of buildings) {
    for (const recipe of building.recipes || []) {
      if (recipe.output.id !== itemId) continue;
      const candidate: ItemRecipe = { recipe, building };
      if (!best || compareItemRecipesForDefaultPick(candidate, best) < 0) {
        best = candidate;
      }
    }
  }
  return best;
};

/**
 * Check if an item has a recipe (is not a raw material)
 */
export const hasRecipe = (itemId: string, buildings: Building[]): boolean => {
  for (const building of buildings) {
    for (const recipe of building.recipes || []) {
      if (recipe.output.id === itemId) return true;
    }
  }
  return false;
};
