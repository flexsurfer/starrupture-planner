import type { Recipe, Item } from "../../state/db";
import { ItemImage } from "./ItemImage";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';

interface RecipeItemIconProps {
  itemId: string;
  amount: number;
  isOutput?: boolean;
  item?: Item;
}

const RecipeItemIcon = ({ itemId, amount, isOutput = false, item }: RecipeItemIconProps) => {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Amount badge */}
      <div className={`badge badge-xs text-xs ${
          isOutput ? 'badge-success' : 'badge-primary'
        }`}>
          {amount}/min
        </div>
      <div className="relative">
        <ItemImage
          itemId={itemId}
          item={item}
          size="medium"
        />
      </div>
      <div className="text-xs text-center max-w-16 leading-tight">
        {item?.name || itemId}
      </div>
    </div>
  );
};

interface RecipeCardProps {
  recipe: Recipe;
  itemsMap: Record<string, Item>;
  className?: string;
}

export const RecipeCard = ({ recipe, itemsMap, className = "" }: RecipeCardProps) => {
  const outputItem = itemsMap[recipe.output.id];

  return (
    <div className={`card bg-base-200 shadow-sm border border-base-300 ${className}`}>
      <div className="card-body p-4">
        <div className="flex items-center gap-4 mb-3">
          {/* Output */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-base-content/70">Output</h4>
            <RecipeItemIcon 
              itemId={recipe.output.id} 
              amount={recipe.output.amount_per_minute} 
              isOutput={true}
              item={itemsMap[recipe.output.id]}
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
            <h4 className="text-sm font-medium text-base-content/70">
              {recipe.inputs.length > 0 ? "Inputs" : "Raw Material"}
            </h4>
            <div className="flex flex-wrap gap-2">
              {recipe.inputs.length > 0 ? (
                recipe.inputs.map((input, idx) => (
                  <RecipeItemIcon 
                    key={`${input.id}-${idx}`} 
                    itemId={input.id} 
                    amount={input.amount_per_minute}
                    item={itemsMap[input.id]}
                  />
                ))
              ) : (
                <div className="text-xs text-base-content/60 italic">
                  No inputs required
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Open in Planner button */}
        <div className="flex">
          <button
            className="btn btn-xs btn-primary"
            onClick={() => {
              dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, recipe.output.id]);
            }}
            title={`Open ${outputItem?.name || recipe.output.id} in planner`}
          >
            Open in Planner
          </button>
        </div>
      </div>
    </div>
  );
};
