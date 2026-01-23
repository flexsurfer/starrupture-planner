import React from 'react';
import type { Item, Recipe, Building } from '../../state/db';
import { RecipeCard } from './RecipeCard';
import { BuildingImage } from './BuildingImage';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  recipe: Recipe | null;
  building: Building | null;
  itemsMap: Record<string, Item>;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  isOpen,
  onClose,
  item,
  recipe,
  building,
  itemsMap
}) => {
  if (!isOpen || !item || !recipe || !building) {
    return null;
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h3 className="text-lg lg:text-xl font-bold pr-4">Recipe for {item.name}</h3>
          <button 
            className="btn btn-sm btn-circle btn-ghost flex-shrink-0" 
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Building Info */}
        <div className="mb-4 lg:mb-6 p-3 lg:p-4 bg-base-200 rounded-lg">
          <div className="flex items-center gap-2 lg:gap-3">
            <BuildingImage buildingId={building.id} building={building} className="w-10 h-10 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm lg:text-base">Produced in: {building.name}</h4>
            </div>
          </div>
        </div>

        {/* Recipe Card */}
        <RecipeCard 
          recipe={recipe}
          itemsMap={itemsMap}
          className="mb-4 lg:mb-6"
        />

        {/* Modal Actions */}
        <div className="modal-action">
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
