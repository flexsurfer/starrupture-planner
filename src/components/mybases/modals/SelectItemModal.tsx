import React, { useState, useEffect } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { Building as DbBuilding, Item } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import { ItemImage } from '../../ui';

interface SelectItemModalProps {
  isOpen: boolean;
  building: DbBuilding;
  currentItemId?: string;
  currentRatePerMinute?: number;
  onClose: () => void;
  onConfirm: (itemId: string, ratePerMinute: number) => void;
}

export const SelectItemModal: React.FC<SelectItemModalProps> = ({
  isOpen,
  building,
  currentItemId,
  currentRatePerMinute,
  onClose,
  onConfirm,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(currentItemId || '');
  const [ratePerMinute, setRatePerMinute] = useState<number>(currentRatePerMinute || 60);

  // Get available items from subscription
  const availableItems = useSubscription<Item[]>([SUB_IDS.AVAILABLE_ITEMS_FOR_BUILDING, building.id]);

  // Sync state with props when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setSelectedItemId(currentItemId || '');
      setRatePerMinute(currentRatePerMinute || 60);
    }
  }, [isOpen, currentItemId, currentRatePerMinute]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemId && ratePerMinute > 0) {
      onConfirm(selectedItemId, ratePerMinute);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedItemId(currentItemId || '');
    setRatePerMinute(currentRatePerMinute || 60);
    onClose();
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    // Set default rate from recipe if available
    if (building.recipes) {
      const recipe = building.recipes.find(r => r.output.id === itemId);
      if (recipe) {
        setRatePerMinute(recipe.output.amount_per_minute);
      }
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Select Item for {building.name}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Item</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-2 border border-base-300 rounded-lg">
              {availableItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item.id)}
                    className={`btn btn-sm flex flex-col items-center gap-1 p-2 h-auto ${
                      isSelected ? 'btn-primary' : 'btn-outline'
                    }`}
                  >
                    <ItemImage
                      itemId={item.id}
                      item={item}
                      size="small"
                      className="w-8 h-8"
                    />
                    <span className="text-xs text-center line-clamp-2">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Rate per Minute</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={ratePerMinute}
              onChange={(e) => setRatePerMinute(Number(e.target.value))}
              min="0.01"
              step="0.01"
              required
            />
            <div className="label">
              <span className="label-text-alt text-base-content/30 text-xs">
                Note: For extractors, options for output rate are 60, 120, or 240 per minute
              </span>
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedItemId || ratePerMinute <= 0}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={handleCancel}></div>
    </div>
  );
};
