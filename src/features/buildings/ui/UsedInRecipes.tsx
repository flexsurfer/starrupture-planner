import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { RecipeCard } from './RecipeCard';

interface UsedInRecipesProps {
  itemId: string;
  itemName: string;
}

export const UsedInRecipes = ({ itemId, itemName }: UsedInRecipesProps) => {
  const recipes = useSubscription(
    [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, itemId]
  );

  if (!recipes || recipes.length === 0) {
    return null;
  }

  return (
    <details className="mt-3 border-t border-base-300 pt-2 sm:mt-4 sm:pt-3">
      <summary className="cursor-pointer py-1 text-xs font-medium text-base-content/70 sm:text-sm" title={`${itemName} is used in ${recipes.length} recipes`}>
        Used in {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
      </summary>
      <div className="mt-2 space-y-2 sm:space-y-3">
        {recipes.map((entry) => (
          <RecipeCard key={`${entry.building.id}:${entry.recipe.id ?? entry.recipeIndex}`} recipe={entry.recipe} recipeType={entry.recipeType} building={entry.building} highlightedItemId={itemId} />
        ))}
      </div>
    </details>
  );
};
