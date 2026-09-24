import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { RecipeCard } from './RecipeCard';

interface UsedInRecipesProps {
  itemId: string;
  itemName: string;
}

export const UsedInRecipes = ({ itemId, itemName }: UsedInRecipesProps) => {
    const { t } = useTranslation();
  const recipes = useSubscription(
    [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, itemId]
  );

  if (!recipes || recipes.length === 0) {
    return null;
  }

  return (
    <details className="mt-3 border-t border-base-300 pt-2 sm:mt-4 sm:pt-3">
      <summary className="cursor-pointer py-1 text-xs font-medium text-base-content/70 sm:text-sm" title={t("{itemName} is used in {count} recipes", { itemName: itemName, count: recipes.length })}>{t("Used in {count} recipes", { count: recipes.length })}</summary>
      <div className="mt-2 space-y-2 sm:space-y-3">
        {recipes.map((entry) => (
          <RecipeCard key={`${entry.building.id}:${entry.recipe.id ?? entry.recipeIndex}`} recipe={entry.recipe} recipeType={entry.recipeType} building={entry.building} highlightedItemId={itemId} />
        ))}
      </div>
    </details>
  );
};
