import type { Building, Item } from "./types";
import { createRecipeResolver } from "./production-flow";

/** Validate against the current recipes, including fallback after a recipe is removed. */
export function getMultiTargetWarning(
  targetIds: string[],
  buildings: Building[],
  recipeSelections: Record<string, string>,
  items: Item[],
): string | null {
  if (!targetIds.length) return null;
  const getRecipe = createRecipeResolver(buildings, recipeSelections);
  const name = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  for (const itemId of targetIds) {
    const recipe = getRecipe(itemId)?.recipe;
    if (
      !recipe?.inputs.length ||
      !Number.isFinite(recipe.output.amount_per_minute) ||
      recipe.output.amount_per_minute <= 0
    ) {
      return `${name(itemId)} has no usable production recipe in the current game data.`;
    }
  }
  // A shared or targeted ingredient is valid. Only revisiting an item on the
  // current dependency path is a cycle; completed branches can be reused.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (itemId: string): string | null => {
    if (visiting.has(itemId))
      return `The selected recipes contain a circular production dependency involving ${name(itemId)}.`;
    if (visited.has(itemId)) return null;
    visiting.add(itemId);
    for (const input of getRecipe(itemId)?.recipe.inputs ?? []) {
      const warning = visit(input.id);
      if (warning) return warning;
    }
    visiting.delete(itemId);
    visited.add(itemId);
    return null;
  };
  for (const itemId of targetIds) {
    const warning = visit(itemId);
    if (warning) return warning;
  }
  return null;
}
