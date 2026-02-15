import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import type { Building, Recipe } from '../../state/db';
import { RecipeCard } from './RecipeCard';
import { BuildingImage } from './BuildingImage';

interface UsedInRecipesProps {
  itemId: string;
  itemName: string;
}

export const UsedInRecipes = ({ itemId, itemName }: UsedInRecipesProps) => {
  const recipes = useSubscription<{ recipe: Recipe; building: Building }[]>(
    [SUB_IDS.ITEMS_RECIPES_BY_INPUT_ITEM_ID, itemId]
  );

  if (!recipes || recipes.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="font-semibold text-sm lg:text-base mb-3">
        {itemName} is used in ({recipes.length}):
      </h4>
      <div className="space-y-3">
        {recipes.map((entry, idx) => (
          <div key={`${entry.building.id}-${idx}`} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BuildingImage
                buildingId={entry.building.id}
                building={entry.building}
                size="small"
              />
              <span className="text-sm font-medium">{entry.building.name}</span>
            </div>
            <RecipeCard recipe={entry.recipe} />
          </div>
        ))}
      </div>
    </div>
  );
};
