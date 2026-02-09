import React, { useState } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { Building } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import type { BuildingSectionType } from '../types';
import { BuildingImage } from '../../ui';

interface AddBuildingCardModalProps {
  isOpen: boolean;
  sectionType: BuildingSectionType;
  onClose: () => void;
  onAdd: (buildingTypeId: string, name?: string, description?: string) => void;
}

export const AddBuildingCardModal: React.FC<AddBuildingCardModalProps> = ({
  isOpen,
  sectionType,
  onClose,
  onAdd,
}) => {
  const buildings = useSubscription<Building[]>([SUB_IDS.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, sectionType]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleBuildingClick = (building: Building) => {
    if (selectedBuilding?.id === building.id) {
      setSelectedBuilding(null);
    } else {
      setSelectedBuilding(building);
    }
  };

  const handleConfirm = () => {
    if (selectedBuilding) {
      onAdd(
        selectedBuilding.id,
        customName.trim() || undefined,
        customDescription.trim() || undefined,
      );
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setSelectedBuilding(null);
    setCustomName('');
    setCustomDescription('');
    onClose();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        {/* Header - fixed */}
        <div className="px-6 pt-6 pb-3 flex-shrink-0">
          <h3 className="font-bold text-lg">Select Building</h3>
        </div>

        {/* Buildings grid - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-3">
            {buildings.map((building) => {
              const isSelected = selectedBuilding?.id === building.id;
              return (
                <div
                  key={building.id}
                  className={`card shadow-md cursor-pointer transition-all hover:shadow-lg ${
                    isSelected
                      ? 'bg-primary/10 border-2 border-primary ring-1 ring-primary/30'
                      : 'bg-base-100 border border-base-300 hover:border-primary'
                  }`}
                  onClick={() => handleBuildingClick(building)}
                >
                  <div className="card-body p-3">
                    {/* Building name */}
                    <div className="text-xs font-semibold mb-2 text-center">
                      {building.name}
                    </div>

                    {/* Building icon */}
                    <div className="flex items-center justify-center mb-2">
                      <BuildingImage
                        buildingId={building.id}
                        building={building}
                        className="w-16 h-16 rounded-full object-cover"
                        size="medium"
                      />
                    </div>

                    {/* Power and Heat info */}
                    <div className="text-xs text-center space-y-1">
                      <div className="flex items-center justify-center gap-1">
                        <span>⚡</span>
                        <span>{building.power || 0}</span>
                      </div>
                      {building.heat !== undefined && (
                        <div className="flex items-center justify-center gap-1">
                          <span>🔥</span>
                          <span>{building.heat}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom section - fixed */}
        <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-base-300 bg-base-100">
          {/* Name & Description inputs */}
          <div className="flex gap-3 mb-4">
            <div className="form-control flex-1">
              <label className="label py-1">
                <span className="label-text text-xs">Name <span className="text-base-content/50">(optional)</span></span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder={selectedBuilding?.name ?? 'Custom name'}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="form-control flex-1">
              <label className="label py-1">
                <span className="label-text text-xs">Description <span className="text-base-content/50">(optional)</span></span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="Add a note..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetAndClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!selectedBuilding}
              onClick={handleConfirm}
            >
              Add
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={resetAndClose}></div>
    </div>
  );
};
