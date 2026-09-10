import { appIds } from '@/app/uklad/catalog';
import type { ReactNode } from 'react';
import type { Building, Item, Recipe, RecipeDisplayType } from "@/app/uklad/model";
import { BuildingImage, ItemImage } from '@/shared/ui';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { getItemCategoryColor, getItemCategoryStyle } from '@/utils/itemColors';

interface RecipeItemIconProps {
  itemId: string;
  amount: number;
  isOutput?: boolean;
  isHighlighted?: boolean;
  item?: Item;
}

const RecipeItemIcon = ({ itemId, amount, isOutput = false, isHighlighted = false, item }: RecipeItemIconProps) => {
  return (
    <div
      className={`flex min-w-0 gap-2 rounded-md border p-2 ${isOutput ? 'flex-col items-center text-center' : 'items-center'} ${isHighlighted ? '' : 'border-transparent bg-base-content/5'}`}
      style={isHighlighted ? getItemCategoryStyle(item?.type) : undefined}
    >
      <div className={`shrink-0 ${isOutput ? '' : '[&>div]:size-8 [&_img]:size-8 sm:[&>div]:size-10 sm:[&_img]:size-10'}`}>
        <ItemImage itemId={itemId} item={item} size="small" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium leading-snug break-words sm:text-sm">{item?.name || itemId}</div>
        <div className={`mt-0.5 font-semibold leading-tight tabular-nums ${isOutput ? 'text-lg' : 'text-sm sm:text-base'}`} style={{ color: getItemCategoryColor(item?.type) }}>
          {amount}<span className="ml-0.5 text-[10px] font-normal sm:text-xs">/min</span>
        </div>
      </div>
    </div>
  );
};

interface RecipeCardProps {
  recipe: Recipe;
  recipeType?: RecipeDisplayType;
  className?: string;
  showPlannerButton?: boolean;
  building?: Building;
  selected?: boolean;
  action?: ReactNode;
  highlightedItemId?: string;
}

export const RecipeCard = ({ recipe, recipeType = 'standard', className = "", showPlannerButton = true, building, selected = false, action, highlightedItemId = recipe.output.id }: RecipeCardProps) => {
  const runtime = useRuntime();
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const outputItem = itemsMap[recipe.output.id];
  const typeLabel = recipeType === 'alternative' ? 'Alternative' : recipeType === 'upgrade' ? 'V2' : 'Standard';

  return (
    <div className={`min-w-0 overflow-hidden rounded-lg border bg-base-200 ${selected ? 'border-primary' : 'border-base-300'} ${className}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-2 py-1.5 sm:px-3 sm:py-2 ${selected ? 'border-primary/20 bg-primary/5' : 'border-base-300'}`}>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {building && <BuildingImage buildingId={building.id} building={building} size="xsmall" className="shrink-0 sm:!size-7" />}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {building && <span className="text-xs font-semibold leading-tight break-words sm:text-sm">{building.name}</span>}
            <span className={`text-[10px] font-medium sm:text-xs ${recipeType === 'alternative' ? 'text-secondary' : recipeType === 'upgrade' ? 'text-info' : 'text-base-content/60'}`}>{typeLabel}</span>
          </div>
          {selected && <span className="sr-only">Used in this node</span>}
        </div>
        {action ?? (showPlannerButton && outputItem?.type !== 'raw' && (
          <button
            type="button"
            className="btn btn-sm btn-primary btn-outline h-8 min-h-8 shrink-0 px-2 text-xs"
            onClick={() => runtime.dispatch([appIds.events.PLANNER_OPEN_ITEM, recipe.output.id])}
            title={`Open ${outputItem?.name || recipe.output.id} in planner`}
          >
            Planner
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-2 p-2 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-3 sm:p-3">
          <div className="min-w-0 space-y-1">
            <h4 className="text-[10px] font-medium text-base-content/60 sm:text-xs">Output</h4>
            <RecipeItemIcon 
              itemId={recipe.output.id} 
              amount={recipe.output.amount_per_minute} 
              isOutput={true}
              isHighlighted={recipe.output.id === highlightedItemId}
              item={itemsMap[recipe.output.id]}
            />
          </div>
          {/* Inputs */}
          <div className="min-w-0 space-y-1">
            <h4 className="text-[10px] font-medium text-base-content/60 sm:text-xs">Inputs</h4>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
              {recipe.inputs.length > 0 ? (
                recipe.inputs.map((input, idx) => (
                  <RecipeItemIcon 
                    key={`${input.id}-${idx}`} 
                    itemId={input.id} 
                    amount={input.amount_per_minute}
                    isHighlighted={input.id === highlightedItemId}
                    item={itemsMap[input.id]}
                  />
                ))
              ) : (
                <div className="py-2 text-xs text-base-content/60 sm:col-span-2">
                  No inputs required
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
