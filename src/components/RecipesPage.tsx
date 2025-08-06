import { useState, useEffect } from "react";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../state/sub-ids";
import type { Building, Item, Recipe } from "../state/db";

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
    const imagePath = `./icons/buildings/${building.id}.jpg`;
    
    return (
      <div className="flex items-center justify-center w-30 h-30">
        <img
          src={imagePath}
          alt={building.name}
          className="w-30 h-30 object-cover rounded-lg shadow-md"
          onError={(e) => {
            // Fallback to showing the building name if image doesn't exist
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }}
        />
        <div className="hidden w-20 h-20 bg-base-300 rounded-lg shadow-md items-center justify-center">
          <span className="text-xs text-center font-medium px-2">
            {building.name}
          </span>
        </div>
      </div>
    );
  };

  const ItemIcon = ({ itemId, amount, isOutput = false }: { itemId: string; amount: number; isOutput?: boolean }) => {
    const item = itemsMap[itemId];
    const imagePath = `./icons/items/${itemId}.jpg`;
    
    return (
      <div className="flex flex-col items-center gap-1">
        {/* Amount badge */}
        <div className={`badge badge-xs text-xs ${
            isOutput ? 'badge-success' : 'badge-primary'
          }`}>
            {amount}/min
          </div>
        <div className="relative">
          <div className="flex items-center justify-center w-15 h-15">
            <img
              src={imagePath}
              alt={item?.name || itemId}
              className="w-15 h-15 object-cover rounded"
              onError={(e) => {
                // Fallback to showing the item ID if image doesn't exist
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) {
                  fallback.style.display = 'block';
                }
              }}
            />
            <code className="text-xs bg-base-200 px-1 py-0.5 rounded hidden text-center">
              {itemId}
            </code>
          </div>
        
        </div>
        <div className="text-xs text-center max-w-16 leading-tight">
          {item?.name || itemId}
        </div>
      </div>
    );
  };

  const RecipeCard = ({ recipe }: { recipe: Recipe }) => {
    return (
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center gap-4">
            {/* Output */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-base-content/70">Output</h4>
              <ItemIcon 
                itemId={recipe.output.id} 
                amount={recipe.output.amount_per_minute} 
                isOutput={true}
              />
            </div>
            

            {/* Arrow */}
            <div className="flex items-center justify-center px-2">
              <svg 
                className="w-6 h-6 text-base-content/50" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l-7 7 7 7" />
              </svg>
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-base-content/70">Inputs</h4>
              <div className="flex flex-wrap gap-2">
                {recipe.inputs.map((input, idx) => (
                  <ItemIcon 
                    key={`${input.id}-${idx}`} 
                    itemId={input.id} 
                    amount={input.amount_per_minute} 
                  />
                ))}
              </div>
            </div>
          </div>
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
          {/* Building Header - Clickable */}
          <div 
            className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-base-200 -mx-4 -mt-4 px-4 pt-4 pb-4 rounded-t-lg transition-colors"
            onClick={onToggle}
          >
            <BuildingIcon building={building} />
            <div className="flex-1">
              <h2 className="card-title text-xl">{building.name}</h2>
              <div className="badge badge-outline">
                {building.recipes.length} recipe{building.recipes.length !== 1 ? 's' : ''}
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
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Buildings & Recipes</h1>
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Total Buildings</div>
              <div className="stat-value text-2xl">{buildings.length}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Total Recipes</div>
              <div className="stat-value text-2xl">
                {buildings.reduce((total, building) => total + building.recipes.length, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Buildings Grid */}
        <div className="grid gap-6">
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