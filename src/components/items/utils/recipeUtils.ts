import type { Recipe, Building } from '../../../state/db';

export interface ItemRecipe {
  recipe: Recipe;
  building: Building;
}

/**
 * Find the recipe and building that produces a given item
 */
export const findItemRecipe = (
  itemId: string, 
  buildings: Building[]
): ItemRecipe | null => {
  for (const building of buildings) {
    for (const recipe of building.recipes) {
      if (recipe.output.id === itemId) {
        return {
          recipe,
          building
        };
      }
    }
  }
  return null;
};

/**
 * Check if an item has a recipe (is not a raw material)
 */
export const hasRecipe = (itemId: string, buildings: Building[]): boolean => {
  return findItemRecipe(itemId, buildings) !== null;
};
