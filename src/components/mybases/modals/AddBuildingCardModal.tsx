import React, { useState } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { Building, Item } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import type { AddBuildingRequest, BuildingSectionType } from '../types';
import { BuildingImage, ItemImage } from '../../ui';
import { isRawExtractor, MAX_BULK_BUILDING_COUNT, sanitizeBulkBuildingCount } from '../utils';
import { SelectItemModal } from './SelectItemModal';

interface AddBuildingCardModalProps {
  isOpen: boolean;
  sectionType: BuildingSectionType;
  onClose: () => void;
  onAdd: (request: AddBuildingRequest) => void;
  requireItemConfiguration?: boolean;
}

export const AddBuildingCardModal: React.FC<AddBuildingCardModalProps> = ({
  isOpen,
  sectionType,
  onClose,
  onAdd,
  requireItemConfiguration = false,
}) => {
  const buildings = useSubscription<Building[]>([SUB_IDS.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, sectionType]);
  const itemsById = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_BY_ID_MAP]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [count, setCount] = useState('1');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [ratePerMinute, setRatePerMinute] = useState('');
  const [showSelectItemModal, setShowSelectItemModal] = useState(false);

  const supportsItemConfiguration = sectionType === 'inputs' || sectionType === 'outputs';
  const mustConfigureItem = supportsItemConfiguration && requireItemConfiguration;
  const selectedItem = selectedItemId ? itemsById[selectedItemId] || null : null;

  if (!isOpen) {
    return null;
  }

  const handleBuildingClick = (building: Building) => {
    if (selectedBuilding?.id === building.id) {
      setSelectedBuilding(null);
      setSelectedItemId('');
      setRatePerMinute('');
    } else {
      setSelectedBuilding(building);
      setSelectedItemId('');
      setRatePerMinute('');
    }
  };

  const handleItemConfigured = (itemId: string, configuredRatePerMinute: number) => {
    setSelectedItemId(itemId);
    setRatePerMinute(String(configuredRatePerMinute));
  };

  const handleConfirm = () => {
    if (!selectedBuilding) return;

    const normalizedCount = sanitizeBulkBuildingCount(Number(count) || 1);
    const normalizedRate = Number(ratePerMinute);
    const hasConfiguredItem = !!selectedItemId && normalizedRate > 0;

    if (mustConfigureItem && !hasConfiguredItem) {
      return;
    }

    onAdd({
      buildingTypeId: selectedBuilding.id,
      count: normalizedCount,
      name: customName.trim() || undefined,
      description: customDescription.trim() || undefined,
      selectedItemId: hasConfiguredItem ? selectedItemId : undefined,
      ratePerMinute: hasConfiguredItem ? normalizedRate : undefined,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedBuilding(null);
    setCustomName('');
    setCustomDescription('');
    setCount('1');
    setSelectedItemId('');
    setRatePerMinute('');
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
          <div className="flex gap-3 mb-4">
            <div className="form-control w-28">
              <label className="label py-1">
                <span className="label-text text-xs">Count</span>
              </label>
              <input
                type="number"
                min="1"
                max={MAX_BULK_BUILDING_COUNT}
                step="1"
                className="input input-bordered input-sm w-full"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                onBlur={() => setCount(String(sanitizeBulkBuildingCount(Number(count) || 1)))}
              />
            </div>
          </div>

          {supportsItemConfiguration && selectedBuilding && (
            <div className="mb-4 rounded-lg border border-base-300 bg-base-200/40 p-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    Item configuration {!mustConfigureItem && <span className="text-base-content/50">(optional)</span>}
                  </div>
                  {selectedItem && (
                    <div className="flex items-center gap-2 min-w-0">
                      <ItemImage
                        itemId={selectedItem.id}
                        item={selectedItem}
                        size="small"
                        className="w-5 h-5"
                      />
                      <span className="text-xs text-base-content/70 truncate">{selectedItem.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowSelectItemModal(true)}
                  >
                    {selectedItem ? 'Change material' : 'Select material'}
                  </button>
                  {selectedItem && (
                    <span className="text-xs text-base-content/70">
                      {selectedItem.name} • {ratePerMinute}/min
                    </span>
                  )}
                  {!selectedItem && !mustConfigureItem && (
                    <span className="text-xs text-base-content/55">No material configured</span>
                  )}
                </div>

                {isRawExtractor(selectedBuilding) && (
                  <p className="text-xs text-base-content/55">
                    Output depends on node purity and extractor tier. Enter your in-game value.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Name & Description inputs */}
          <div className="flex gap-3 mb-4">
            <div className="form-control flex-1">
              <label className="label py-1">
                <span className="label-text text-xs">Name <span className="text-base-content/50">(optional, applies to all)</span></span>
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
              disabled={!selectedBuilding || (mustConfigureItem && (!selectedItemId || Number(ratePerMinute) <= 0))}
              onClick={handleConfirm}
            >
              Add
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={resetAndClose}></div>
      {selectedBuilding && supportsItemConfiguration && (
        <SelectItemModal
          isOpen={showSelectItemModal}
          building={selectedBuilding}
          currentItemId={selectedItemId || undefined}
          currentRatePerMinute={Number(ratePerMinute) > 0 ? Number(ratePerMinute) : undefined}
          onClose={() => setShowSelectItemModal(false)}
          onConfirm={(itemId, configuredRatePerMinute) => {
            handleItemConfigured(itemId, configuredRatePerMinute);
            setShowSelectItemModal(false);
          }}
        />
      )}
    </div>
  );
};
