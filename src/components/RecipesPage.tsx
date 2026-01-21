import { useState, useEffect } from "react";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../state/sub-ids";
import type { Building, Item } from "../state/db";
import { BuildingImage, RecipeCard } from "./ui";

const RecipesPage = () => {
  const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_MAP]);
  
  // Track collapsed state for each building (collapsed by default)
  const [collapsedBuildings, setCollapsedBuildings] = useState<Set<string>>(new Set());
  
  // Initialize collapsed state when buildings load
  useEffect(() => {
    if (buildings.length > 0 && collapsedBuildings.size === 0) {
      setCollapsedBuildings(new Set(buildings.map(building => building.id)));
    }
  }, [buildings, collapsedBuildings.size]);
  
  const toggleBuilding = (buildingId: string) => {
    const newCollapsed = new Set(collapsedBuildings);
    if (newCollapsed.has(buildingId)) {
      newCollapsed.delete(buildingId);
    } else {
      newCollapsed.add(buildingId);
    }
    setCollapsedBuildings(newCollapsed);
  };
  
  const BuildingIcon = ({ building }: { building: Building }) => {
    return (
      <div className="flex items-center justify-center w-30 h-30">
        <BuildingImage
          buildingId={building.id}
          building={building}
          size="large"
          className="rounded-lg shadow-md"
        />
        <div className="hidden w-20 h-20 bg-base-300 rounded-lg shadow-md items-center justify-center">
          <span className="text-xs text-center font-medium px-2">
            {building.name}
          </span>
        </div>
      </div>
    );
  };



  const BuildingCard = ({ building, isCollapsed, onToggle }: { 
    building: Building;
    isCollapsed: boolean;
    onToggle: () => void;
  }) => {
    return (
      <div className="card bg-base-100 shadow-lg border border-base-300">
        <div className="card-body">
          {/* Building Header - Clickable & Sticky */}
          <div
            className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-base-200 -mx-4 -mt-4 px-4 pt-4 pb-4 rounded-t-lg transition-colors sticky top-0 z-10 bg-base-100"
            onClick={onToggle}
          >
            <BuildingIcon building={building} />
            <div className="flex-1">
              <h2 className="card-title text-xl">{building.name}</h2>
              <div className="flex gap-2 flex-wrap">
                <div className="badge badge-outline">
                  {building.recipes.length} recipe{building.recipes.length !== 1 ? 's' : ''}
                </div>
                <div className="badge badge-primary">
                  ⚡ {building.power} 
                </div>
              </div>
            </div>
            {/* Collapse Arrow */}
            <div className="flex-shrink-0">
              <svg 
                className={`w-6 h-6 text-base-content transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Recipes - Collapsible */}
          {!isCollapsed && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Recipes</h3>
              <div className="grid gap-3">
                {building.recipes.map((recipe, idx) => (
                  <RecipeCard 
                    key={`${building.id}-recipe-${idx}`} 
                    recipe={recipe}
                    itemsMap={itemsMap}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:gap-6">
        {/* Header section - responsive */}
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
          <h1 className="text-2xl lg:text-3xl font-bold">Buildings & Recipes</h1>
          <div className="stats shadow stats-vertical sm:stats-horizontal">
            <div className="stat">
              <div className="stat-title text-xs sm:text-sm">Total Buildings</div>
              <div className="stat-value text-lg sm:text-2xl">{buildings.length}</div>
            </div>
            <div className="stat">
              <div className="stat-title text-xs sm:text-sm">Total Recipes</div>
              <div className="stat-value text-lg sm:text-2xl">
                {buildings.reduce((total, building) => total + building.recipes.length, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Buildings Grid */}
        <div className="grid gap-4 lg:gap-6">
          {buildings.map((building) => (
            <BuildingCard 
              key={building.id} 
              building={building}
              isCollapsed={collapsedBuildings.has(building.id)}
              onToggle={() => toggleBuilding(building.id)}
            />
          ))}
        </div>

        {buildings.length === 0 && (
          <div className="text-center py-8">
            <div className="text-base-content/60">No buildings data available</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipesPage;