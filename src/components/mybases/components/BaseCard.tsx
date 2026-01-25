import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { Base } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import { ItemImage, BuildingImage } from '../../ui';
import type {
  BaseDetailStats,
  BaseInputItem,
  BaseOutputItem,
  BaseDefenseBuilding,
} from '../types';

interface BaseCardProps {
  base: Base;
  onOpen: (baseId: string) => void;
  onRename: (baseId: string) => void;
  onDelete: (baseId: string) => void;
}

export const BaseCard: React.FC<BaseCardProps> = ({ base, onOpen, onRename, onDelete }) => {
  // Use parameterized subscriptions
  const stats = useSubscription<BaseDetailStats | null>([SUB_IDS.BASE_DETAIL_STATS, base.id]);
  const inputItems = useSubscription<BaseInputItem[]>([SUB_IDS.BASE_INPUT_ITEMS, base.id]);
  const outputItems = useSubscription<BaseOutputItem[]>([SUB_IDS.BASE_OUTPUT_ITEMS, base.id]);
  const defenseBuildings = useSubscription<BaseDefenseBuilding[]>([SUB_IDS.BASE_DEFENSE_BUILDINGS, base.id]);

  // Early return if stats not available
  if (!stats) {
    return null;
  }

  const {totalHeat, energyGeneration, energyConsumption, baseCoreHeatCapacity, heatPercentage, energyPercentage, isHeatOverCapacity, isEnergyInsufficient} = stats;
  
  return (
    <div className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow">
      <div className="card-body p-4 flex flex-col">
        <h3 className="card-title text-lg font-semibold mb-3">{base.name}</h3>
        {/* Row 1: Image | Base Info */}
        <div className="flex items-start gap-6 mb-4">
          <div className="flex-shrink-0 flex flex-col">
            <img
              src="/icons/buildings/base_core.png"
              alt="Base Core"
              className="w-30 h-30 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>

          <div className="flex flex-col flex-1 min-w-0 gap-2 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-base-content/70">Buildings:</span>
              <span className="font-medium">{base.buildings.length}</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className={isHeatOverCapacity ? 'text-error' : 'text-base-content/70'}>Heat:</span>
                <span className={`font-medium ${isHeatOverCapacity ? 'text-error' : ''}`}>{totalHeat} / {baseCoreHeatCapacity}</span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
                  style={{ width: `${heatPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className={isEnergyInsufficient ? 'text-error' : 'text-base-content/70'}>Energy:</span>
                <span className={`font-medium ${isEnergyInsufficient ? 'text-error' : ''}`}>{energyConsumption} / {energyGeneration} MW</span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isEnergyInsufficient ? 'bg-error' : 'bg-success'
                    }`}
                  style={{ width: `${energyPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Input Items, Output Items, and Defense */}
        {(inputItems.length > 0 || outputItems.length > 0 || defenseBuildings.length > 0) && (
          <div className="mb-4 space-y-3">
            {inputItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm text-base-content/70 mb-1">Input Items</div>
                <div className="flex flex-wrap gap-2">
                  {inputItems.map(({ item, ratePerMinute }) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1 bg-base-300 rounded-lg px-2 py-1"
                      title={`${item.name} - ${ratePerMinute}/min`}
                    >
                      <ItemImage
                        itemId={item.id}
                        item={item}
                        size="small"
                        className="w-5 h-5"
                      />
                      <span className="text-xs font-medium">{ratePerMinute}/min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {outputItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm text-base-content/70 mb-1">Output Items</div>
                <div className="flex flex-wrap gap-2">
                  {outputItems.map(({ item, ratePerMinute }) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1 bg-base-300 rounded-lg px-2 py-1"
                      title={`${item.name} - ${ratePerMinute}/min`}
                    >
                      <ItemImage
                        itemId={item.id}
                        item={item}
                        size="small"
                        className="w-5 h-5"
                      />
                      <span className="text-xs font-medium">{ratePerMinute}/min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {defenseBuildings.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm text-base-content/70 mb-1">Defense</div>
                <div className="flex flex-wrap gap-2">
                  {defenseBuildings.map(({ building, count }) => (
                    <div
                      key={building.id}
                      className="flex items-center gap-1 bg-base-300 rounded-lg px-2 py-1"
                      title={`${building.name}${count > 1 ? ` (${count})` : ''}`}
                    >
                      <BuildingImage
                        buildingId={building.id}
                        building={building}
                        size="small"
                      />
                      <span className="text-xs font-medium">{building.name}</span>
                      {count > 1 && (
                        <span className="text-xs font-medium text-base-content/70">×{count}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Controls (always at bottom) */}
        <div className="card-actions justify-end gap-2 mt-auto">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onOpen(base.id)}
          >
            Open
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onRename(base.id)}
          >
            Rename
          </button>
          <button
            className="btn btn-sm btn-error btn-outline"
            onClick={() => onDelete(base.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
