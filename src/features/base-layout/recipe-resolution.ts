import type { BaseLayoutBuilding, Building, Recipe } from "@/app/uklad/model";

const STABLE_RECIPE_SELECTION_PREFIX = "output";

export function createRecipeSelectionKey(
  buildingId: string,
  outputItemId: string,
): string {
  return `${STABLE_RECIPE_SELECTION_PREFIX}:${buildingId}:${outputItemId}`;
}

export function matchesRecipeSelectionKey(
  selectionKey: string,
  buildingId: string,
  outputItemId: string,
  recipeIndex: number,
): boolean {
  if (selectionKey === createRecipeSelectionKey(buildingId, outputItemId)) {
    return true;
  }

  return selectionKey === `${buildingId}:${recipeIndex}`;
}

export function findRecipeIndexByOutputItemId(
  building: Building | undefined,
  outputItemId: string,
): number {
  if (!building?.recipes?.length) {
    return -1;
  }

  return building.recipes.findIndex(
    (recipe) => recipe.output.id === outputItemId,
  );
}

export function resolveLayoutBuildingRecipeIndex(
  layoutBuilding: Pick<BaseLayoutBuilding, "itemId" | "recipeIndex">,
  building: Building | undefined,
): number {
  const outputRecipeIndex = findRecipeIndexByOutputItemId(
    building,
    layoutBuilding.itemId,
  );
  if (outputRecipeIndex >= 0) {
    return outputRecipeIndex;
  }

  if (!building?.recipes?.length) {
    return -1;
  }

  if (
    layoutBuilding.recipeIndex >= 0 &&
    layoutBuilding.recipeIndex < building.recipes.length
  ) {
    return layoutBuilding.recipeIndex;
  }

  return -1;
}

export function resolveLayoutBuildingRecipe(
  layoutBuilding: Pick<BaseLayoutBuilding, "itemId" | "recipeIndex">,
  building: Building | undefined,
): Recipe | undefined {
  const recipeIndex = resolveLayoutBuildingRecipeIndex(
    layoutBuilding,
    building,
  );
  if (recipeIndex < 0 || !building?.recipes) {
    return undefined;
  }

  return building.recipes[recipeIndex];
}
