import type { Building, Recipe, RecipeDisplayType } from '@/app/uklad/model';

export interface ItemRecipe {
  recipe: Recipe;
  building: Building;
  recipeIndex: number;
  recipeType: RecipeDisplayType;
}

const RECIPE_TYPE_ORDER: Record<RecipeDisplayType, number> = {
  standard: 0,
  upgrade: 0,
  alternative: 1,
};

/** Resolves visual recipe type, with explicit alternatives overriding building tier. */
export function getRecipeDisplayType(
  recipe: Recipe,
  building: Building,
  buildings: Building[],
): RecipeDisplayType {
  if (recipe.variant === 'alternative') return 'alternative';
  return buildings.some(({ upgrade }) => upgrade === building.id) ? 'upgrade' : 'standard';
}

/** Keeps alternatives last, then applies the production-flow rate/name ordering. */
export function compareItemRecipesForDisplay(a: ItemRecipe, b: ItemRecipe): number {
  const typeDiff = RECIPE_TYPE_ORDER[a.recipeType] - RECIPE_TYPE_ORDER[b.recipeType];
  if (typeDiff !== 0) return typeDiff;
  const rateDiff = a.recipe.output.amount_per_minute - b.recipe.output.amount_per_minute;
  if (rateDiff !== 0) return rateDiff;
  const nameDiff = a.building.name.localeCompare(b.building.name);
  if (nameDiff !== 0) return nameDiff;
  return a.recipeIndex - b.recipeIndex;
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
    for (const [recipeIndex, recipe] of (building.recipes || []).entries()) {
      if (recipe.output.id === itemId) {
        results.push({
          recipe,
          building,
          recipeIndex,
          recipeType: getRecipeDisplayType(recipe, building, buildings),
        });
      }
    }
  }

  return results.sort(compareItemRecipesForDisplay);
};

export const findItemRecipe = (
  itemId: string,
  buildings: Building[]
): ItemRecipe | null => {
  return findItemRecipes(itemId, buildings)[0] ?? null;
};

/** Finds recipes consuming an item, using the same display ordering and metadata. */
export const findRecipesUsingInput = (
  itemId: string,
  buildings: Building[],
): ItemRecipe[] => {
  if (!itemId) return [];

  const results: ItemRecipe[] = [];
  for (const building of buildings) {
    for (const [recipeIndex, recipe] of (building.recipes || []).entries()) {
      if (recipe.inputs.some((input) => input.id === itemId)) {
        results.push({
          recipe,
          building,
          recipeIndex,
          recipeType: getRecipeDisplayType(recipe, building, buildings),
        });
      }
    }
  }

  return results.sort(compareItemRecipesForDisplay);
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
