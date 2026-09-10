import React from 'react';
import type { Item } from '@/app/uklad/model';
import { RecipeCard } from './RecipeCard';
import { UsedInRecipes } from './UsedInRecipes';
import type { ItemRecipe } from '../recipe-utils';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  itemRecipes: ItemRecipe[];
}

export const RecipeModal: React.FC<RecipeModalProps> = ({ isOpen, onClose, item, itemRecipes }) => {

  if (!isOpen || !item || itemRecipes.length === 0) {
    return null;
  }

  return (
    <div className="modal modal-open p-1 sm:p-4" role="dialog" aria-modal="true" aria-label={`Recipes for ${item.name}`}>
      <div className="modal-box flex max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg p-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-base-300 px-3 py-2 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight break-words sm:text-lg">{item.name}</h3>
            <p className="mt-0.5 text-[11px] text-base-content/60 sm:text-xs">{itemRecipes.length} {itemRecipes.length === 1 ? 'recipe' : 'recipes'} · Rates per building</p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost size-9 shrink-0"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3">
          {/* Production Recipes */}
          <div className="space-y-2 sm:space-y-3">
            {itemRecipes.map(({ recipe, building, recipeIndex, recipeType }) => (
              <RecipeCard key={`${building.id}:${recipe.id ?? recipeIndex}`} recipe={recipe} recipeType={recipeType} building={building} />
            ))}
          </div>

          {/* Recipes where this item is used as input */}
          <UsedInRecipes itemId={item.id} itemName={item.name} />
        </div>
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
