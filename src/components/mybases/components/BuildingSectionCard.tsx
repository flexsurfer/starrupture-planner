import React, { useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import type { BaseBuilding, Building as DbBuilding, Item } from '../../../state/db';
import { EVENT_IDS } from '../../../state/event-ids';
import { SUB_IDS } from '../../../state/sub-ids';
import { BuildingImage, ItemImage } from '../../ui';
import { SelectItemModal } from '../modals';

interface BuildingSectionCardProps {
  baseBuilding: BaseBuilding;
  building: DbBuilding;
  baseId: string;
  activePlanNames?: string[];
}

export const BuildingSectionCard: React.FC<BuildingSectionCardProps> = ({
  baseBuilding,
  building,
  baseId,
  activePlanNames = [],
}) => {
  const [showSelectItemModal, setShowSelectItemModal] = useState(false);

  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_MAP]);
  const selectedItem = baseBuilding.selectedItemId ? itemsMap[baseBuilding.selectedItemId] : null;
  
  // Use the stored sectionType - item selection is only for inputs and outputs
  const isInputBuilding = baseBuilding.sectionType === 'inputs';
  const isOutputBuilding = baseBuilding.sectionType === 'outputs';
  
  // Check if this building is part of any active plan
  const isInActivePlan = activePlanNames.length > 0;

  const handleRemoveClick = () => {
    dispatch([EVENT_IDS.REMOVE_BUILDING_FROM_BASE, baseBuilding.id]);
  };

  const handleItemSelectClick = () => {
    setShowSelectItemModal(true);
  };

  const handleConfirmItemSelection = (itemId: string, ratePerMinute: number) => {
    dispatch([EVENT_IDS.UPDATE_BUILDING_ITEM_SELECTION, baseId, baseBuilding.id, itemId, ratePerMinute]);
    setShowSelectItemModal(false);
  };

  return (
    <>
      <div className={`card bg-base-200 shadow-md relative ${isInActivePlan ? 'border-2 border-primary ring-1 ring-primary/30' : 'border border-base-300'}`}>
        <div className="card-body p-3">
          <div className="flex flex-col gap-3">
            {/* Building name and active plan badge */}
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold">
                {building.name}
              </div>
              {isInActivePlan && (
                <div className="flex flex-wrap gap-1">
                  {activePlanNames.map((planName) => (
                    <span
                      key={planName}
                      className="badge badge-primary badge-xs text-[10px] text-left inline-block truncate max-w-[100px]"
                      title={planName}
                    >
                      {planName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-row flex-1 justify-between">
              {/* Building icon - left side, bigger */}
              <BuildingImage
                buildingId={building.id}
                building={building}
                className="w-30 h-30 rounded-lg object-cover"
                size="medium"
              />
              {/* Item selection area - left of image (for input and output buildings) */}
              {(isInputBuilding || isOutputBuilding) && (
                <button
                  onClick={handleItemSelectClick}
                  className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-base-300 hover:border-primary rounded-lg flex flex-col items-center justify-center gap-1 transition-colors bg-base-100"
                  title={selectedItem ? `${selectedItem.name} - ${baseBuilding.ratePerMinute}/min` : 'Select item'}
                >
                  {selectedItem ? (
                    <>
                      <ItemImage
                        itemId={selectedItem.id}
                        item={selectedItem}
                        size="small"
                        className="w-8 h-8"
                      />
                      <span className="text-xs text-center">{baseBuilding.ratePerMinute}/min</span>
                    </>
                  ) : (
                    <svg
                      className="w-6 h-6 text-base-content/50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  )}
                </button>
              )}

            </div>

            {/* Right side content */}
            <div className="flex-1 flex flex-row">

              {/* Power and Heat info */}
              <div className="text-xs flex flex-row gap-1 items-center ml-5" >
                <span>⚡</span>
                <span>{building.power || 0}</span>
                <span>🔥</span>
                <span>{building.heat || 0}</span>
              </div>

              {/* Remove button - positioned at bottom right */}
              <div className="flex-1 flex items-end justify-end mt-auto">
                <button
                  className="btn btn-xs btn-error btn-outline"
                  onClick={handleRemoveClick}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(isInputBuilding || isOutputBuilding) && (
        <SelectItemModal
          isOpen={showSelectItemModal}
          building={building}
          currentItemId={baseBuilding.selectedItemId}
          currentRatePerMinute={baseBuilding.ratePerMinute}
          onClose={() => setShowSelectItemModal(false)}
          onConfirm={handleConfirmItemSelection}
        />
      )}
    </>
  );
};
