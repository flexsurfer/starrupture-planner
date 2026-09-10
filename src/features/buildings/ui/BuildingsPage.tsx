import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { BuildingImage, ExpandableSection } from '@/shared/ui';
import { RecipeCard } from './RecipeCard';
import { getRecipeDisplayType } from '../recipe-utils';
import { useItemsData } from '@/features/items/ui/hooks/useItemsData';
import { CorporationUsageBadge } from '@/features/corporations/ui/CorporationUsageBadge';

const BuildingsPage = () => {
  const sortedBuildings = useSubscription([appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST]);
  const { findBuildingCorporationUsage, getCorporationId } = useItemsData();
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());

  const toggleBuilding = (buildingId: string) => {
    setExpandedBuildings(previous => {
      const next = new Set(previous);
      if (next.has(buildingId)) next.delete(buildingId);
      else next.add(buildingId);
      return next;
    });
  };

  const totalRecipes = sortedBuildings.reduce((total, building) => total + (building.recipes?.length ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl p-2 sm:p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-lg font-bold sm:text-xl">Buildings & Recipes</h1>
        <p className="text-xs text-base-content/60 tabular-nums">
          <span className="font-semibold text-base-content">{sortedBuildings.length}</span> buildings
          <span className="mx-2" aria-hidden="true">·</span>
          <span className="font-semibold text-base-content">{totalRecipes}</span> recipes
        </p>
      </header>

      <div className="space-y-2 sm:space-y-3">
        {sortedBuildings.map(building => {
          const displayRecipes = (building.recipes ?? [])
            .map((recipe, recipeIndex) => ({
              recipe,
              recipeIndex,
              recipeType: getRecipeDisplayType(recipe, building, sortedBuildings),
            }))
            .sort((a, b) => Number(a.recipeType === 'alternative') - Number(b.recipeType === 'alternative') || a.recipeIndex - b.recipeIndex);

          return (
            <ExpandableSection
              key={building.id}
              title={building.name}
              icon={<BuildingImage buildingId={building.id} building={building} size="small" className="sm:!size-12" />}
              expanded={expandedBuildings.has(building.id)}
              onToggle={() => toggleBuilding(building.id)}
              summary={<>
                <span>{displayRecipes.length} {displayRecipes.length === 1 ? 'recipe' : 'recipes'}</span>
                <span title="Power consumption">⚡ {building.power ?? 0}</span>
                <span title="Heat generation">🔥 {building.heat ?? 0}</span>
                {findBuildingCorporationUsage(building.name).map((usage, index) => (
                  <CorporationUsageBadge key={index} usage={usage} corporationId={getCorporationId(usage.corporation)} />
                ))}
              </>}
            >
              <div className="grid items-start gap-2 xl:grid-cols-2 xl:gap-3">
                {displayRecipes.map(({ recipe, recipeIndex, recipeType }) => (
                  <RecipeCard key={`${building.id}:${recipe.id ?? recipeIndex}`} recipe={recipe} recipeType={recipeType} />
                ))}
              </div>
            </ExpandableSection>
          );
        })}
      </div>

      {sortedBuildings.length === 0 && <p className="py-8 text-center text-sm text-base-content/60">No production buildings available</p>}
    </div>
  );
};

export default BuildingsPage;
