import React, { useCallback, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import type { Base, BaseBuilding, Building, Item } from '../../../state/db';
import { EVENT_IDS } from '../../../state/event-ids';
import { SUB_IDS } from '../../../state/sub-ids';
import type { BuildingSectionBuilding } from '../types';
import { sanitizeBuildingCount } from '../utils';
import { BuildingImage, ItemImage } from '../../ui';
import { LinkOutputModal, SelectItemModal } from '../modals';
import { BuildingCountControl } from './BuildingCountControl';
import { resolveInputBuilding, resolveLinkedOutput } from '../../../utils/productionPlanInputs';
import type { ResolvedInputBuilding } from '../../../utils/productionPlanInputs';
import type { LinkableOutputItem } from '../types';

interface LinkedInputData {
  resolved: ResolvedInputBuilding;
  hasError: boolean;
  label: string;
}

/**
 * Subscribes to BASES_LIST only when rendered (i.e. only for linked input cards).
 * Keeps the parent BuildingSectionCard free from that subscription.
 */
const useLinkedInputData = (baseBuilding: BaseBuilding): LinkedInputData => {
  const allBases = useSubscription<Base[]>([SUB_IDS.BASES_LIST]) || [];
  const buildingsById = useSubscription<Record<string, Building>>([SUB_IDS.BUILDINGS_BY_ID_MAP]);

  const resolved = resolveInputBuilding(baseBuilding, allBases);
  const resolution = resolveLinkedOutput(baseBuilding, allBases);
  const sourceOutputBuilding = resolution.sourceOutput
    ? buildingsById[resolution.sourceOutput.buildingTypeId]
    : null;

  const baseName = resolution.sourceBase?.name || 'Missing base';
  const outputName =
    resolution.sourceOutput?.name ||
    sourceOutputBuilding?.name ||
    baseBuilding.linkedOutput?.buildingId ||
    '';
  const label = `${baseName}${outputName ? ` / ${outputName}` : ''}`;
  const hasError = !!resolved.linkedOutput && resolved.linkedOutputStatus !== 'ok';

  return { resolved, hasError, label };
};

interface LinkedInputBadgeProps {
  baseBuilding: BaseBuilding;
}

const LinkedInputBadge: React.FC<LinkedInputBadgeProps> = ({ baseBuilding }) => {
  const { hasError, label } = useLinkedInputData(baseBuilding);

  return (
    <div
      className={`badge badge-xs w-fit max-w-full truncate ${hasError ? 'badge-error' : 'badge-outline'}`}
      title={hasError ? `Broken linked output: ${label}` : `Linked output: ${label}`}
    >
      {hasError ? 'Broken link' : label}
    </div>
  );
};

interface LinkedInputItemButtonProps {
  baseBuilding: BaseBuilding;
  baseId: string;
}

const LinkedInputItemButton: React.FC<LinkedInputItemButtonProps> = ({ baseBuilding, baseId }) => {
  const [showLinkOutputModal, setShowLinkOutputModal] = useState(false);
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_BY_ID_MAP]);
  const { resolved, hasError, label } = useLinkedInputData(baseBuilding);
  const selectedItem = resolved.selectedItemId ? itemsMap[resolved.selectedItemId] : null;

  const handleConfirmLinkedOutput = (output: LinkableOutputItem) => {
    dispatch([
      EVENT_IDS.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
      baseId,
      baseBuilding.id,
      output.baseId,
      output.baseBuildingId,
    ]);
    setShowLinkOutputModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowLinkOutputModal(true)}
        className={`flex-shrink-0 w-20 min-h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors bg-base-100 px-1 ${
          hasError
            ? 'border-error hover:border-error'
            : 'border-base-300 hover:border-primary'
        }`}
        title={`${hasError ? 'Edit broken linked output' : 'Edit linked output'}: ${label}`}
      >
        {selectedItem ? (
          <>
            <ItemImage
              itemId={selectedItem.id}
              item={selectedItem}
              size="small"
              className="w-8 h-8"
            />
            <span className="text-xs text-center">{resolved.ratePerMinute}/min</span>
            <span className={`badge badge-xs px-1 min-h-0 h-4 ${hasError ? 'badge-error' : 'badge-outline'}`}>
              Linked
            </span>
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
      <LinkOutputModal
        isOpen={showLinkOutputModal}
        onClose={() => setShowLinkOutputModal(false)}
        onSelect={handleConfirmLinkedOutput}
      />
    </>
  );
};

interface BuildingSectionCardProps {
  sectionBuilding: BuildingSectionBuilding;
  baseId: string;
}

export const BuildingSectionCard: React.FC<BuildingSectionCardProps> = ({
  sectionBuilding,
  baseId,
}) => {
  const [showSelectItemModal, setShowSelectItemModal] = useState(false);

  const { baseBuilding, building, count, isGrouped, sectionType, activePlanNames } = sectionBuilding;
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_BY_ID_MAP]);

  const isInputBuilding = !isGrouped && baseBuilding?.sectionType === 'inputs';
  const isOutputBuilding = !isGrouped && baseBuilding?.sectionType === 'outputs';
  const isLinkedInput = isInputBuilding && !!baseBuilding?.linkedOutput;

  const selectedItem = baseBuilding?.selectedItemId ? itemsMap[baseBuilding.selectedItemId] : null;
  const displayName = baseBuilding?.name || building.name;
  const description = baseBuilding?.description;
  const totalPower = (building.power || 0) * count;
  const totalHeat = (building.heat || 0) * count;

  const isInActivePlan = activePlanNames.length > 0;
  const sectionLabel = sectionType[0].toUpperCase() + sectionType.slice(1);

  const setGroupedCount = useCallback((nextCount: number) => {
    dispatch([
      EVENT_IDS.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
      baseId,
      building.id,
      sectionType,
      sanitizeBuildingCount(nextCount),
    ]);
  }, [baseId, building.id, sectionType]);

  const handleRemoveClick = () => {
    if (isGrouped) {
      dispatch([
        EVENT_IDS.UI_SHOW_CONFIRMATION_DIALOG,
        `Remove ${building.name}?`,
        `Remove all ${count} ${building.name} building${count !== 1 ? 's' : ''} from ${sectionLabel}?`,
        () => setGroupedCount(0),
        {
          confirmLabel: 'Remove',
          confirmButtonClass: 'btn-error',
        },
      ]);
      return;
    }

    if (!baseBuilding) return;
    dispatch([EVENT_IDS.BASES_REMOVE_BUILDING, baseBuilding.id]);
  };

  const handleConfirmItemSelection = (itemId: string, ratePerMinute: number) => {
    if (!baseBuilding) return;
    dispatch([EVENT_IDS.BASES_UPDATE_BUILDING_ITEM_SELECTION, baseId, baseBuilding.id, itemId, ratePerMinute]);
    setShowSelectItemModal(false);
  };

  return (
    <>
      <div className={`card bg-base-200 shadow-md relative ${isInActivePlan ? 'border-2 border-primary ring-1 ring-primary/30' : 'border border-base-300'}`}>
        <div className="card-body p-3">
          <div className="flex flex-col gap-3">
            {/* Building name and active plan badge */}
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold min-w-0 truncate" title={displayName}>
                  {displayName}
                </div>
                {isGrouped && (
                  <span className="badge badge-outline badge-xs font-mono shrink-0">x{count}</span>
                )}
              </div>
              {description && (
                <div className="text-xs text-base-content/60 line-clamp-2" title={description}>
                  {description}
                </div>
              )}
              {isLinkedInput && baseBuilding && (
                <LinkedInputBadge baseBuilding={baseBuilding} />
              )}
              {isInActivePlan && (
                <div className="flex flex-wrap gap-1">
                  {activePlanNames.map((planName) => (
                    <span
                      key={planName}
                      className="badge badge-primary badge-xs text-[10px] text-left inline-block truncate w-full"
                      title={planName}
                    >
                      {planName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-row flex-1 justify-between gap-2">
              <div className="flex flex-col items-center gap-2">
                {/* Building icon - left side, bigger */}
                <BuildingImage
                  buildingId={building.id}
                  building={building}
                  className="w-30 h-30 rounded-lg object-cover"
                  size="medium"
                />
                {isGrouped && (
                  <BuildingCountControl
                    value={count}
                    ariaLabel={`${building.name} ${sectionType} count`}
                    onChange={setGroupedCount}
                  />
                )}
              </div>
              {/* Item selection area */}
              {isLinkedInput && baseBuilding ? (
                <LinkedInputItemButton baseBuilding={baseBuilding} baseId={baseId} />
              ) : (isInputBuilding || isOutputBuilding) && baseBuilding ? (
                <button
                  onClick={() => setShowSelectItemModal(true)}
                  className="flex-shrink-0 w-20 min-h-20 border-2 border-dashed border-base-300 hover:border-primary rounded-lg flex flex-col items-center justify-center gap-1 transition-colors bg-base-100 px-1"
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
              ) : null}

            </div>

            {/* Right side content */}
            <div className="flex-1 flex flex-row">

              {/* Power and Heat info */}
              <div className="text-xs flex flex-row gap-1 items-center ml-5" >
                <span>⚡</span>
                <span>{totalPower}</span>
                <span>🔥</span>
                <span>{totalHeat}</span>
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

      {(isInputBuilding || isOutputBuilding) && !isLinkedInput && baseBuilding && (
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
