import React from 'react';
import type { Item } from '../../state/db';
import { RecipeCard } from './RecipeCard';
import { BuildingImage } from './BuildingImage';
import { UsedInRecipes } from './UsedInRecipes';
import type { ItemRecipe } from '../items';

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
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 lg:mb-6 flex-shrink-0">
          <h3 className="text-lg lg:text-xl font-bold pr-4">Recipe for {item.name}</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost flex-shrink-0"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {/* Production Recipes */}
          <div className="space-y-4 mb-4 lg:mb-6">
            {itemRecipes.map(({ recipe, building }, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <BuildingImage buildingId={building.id} building={building} size="small" />
                  <span className="text-sm font-medium">{building.name}</span>
                </div>

                <RecipeCard recipe={recipe} />
              </div>
            ))}
          </div>

          {/* Recipes where this item is used as input */}
          <UsedInRecipes itemId={item.id} itemName={item.name} />
        </div>

        {/* Modal Actions */}
        <div className="modal-action flex-shrink-0">
          <button className="btn btn-primary btn-sm lg:btn-md" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
