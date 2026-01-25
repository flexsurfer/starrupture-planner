import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { Building } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import type { BuildingSectionType } from '../types';
import { BuildingImage } from '../../ui';

interface AddBuildingCardModalProps {
  isOpen: boolean;
  sectionType: BuildingSectionType;
  onClose: () => void;
  onAdd: (buildingTypeId: string) => void;
}

export const AddBuildingCardModal: React.FC<AddBuildingCardModalProps> = ({
  isOpen,
  sectionType,
  onClose,
  onAdd,
}) => {
  const buildings = useSubscription<Building[]>([SUB_IDS.AVAILABLE_BUILDINGS_FOR_SECTION, sectionType]);
  if (!isOpen) {
    return null;
  }

  const handleBuildingClick = (buildingId: string) => {
    onAdd(buildingId);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">Select Building</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {buildings.map((building) => (
            <div
              key={building.id}
              className="card bg-base-100 shadow-md border border-base-300 hover:border-primary cursor-pointer transition-all hover:shadow-lg"
              onClick={() => handleBuildingClick(building.id)}
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
          ))}
        </div>

        <div className="modal-action mt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleCancel}></div>
    </div>
  );
};
