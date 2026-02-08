import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { Base, Item, Production } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import { ItemImage, BuildingImage } from '../../ui';
import type {
  BaseDetailStats,
  BaseInputItem,
  BaseOutputItem,
  BaseDefenseBuilding,
  ProductionPlanRequirementsStatus,
} from '../types';

interface BaseCardProps {
  base: Base;
  onOpen: (baseId: string) => void;
  onRename: (baseId: string) => void;
  onDelete: (baseId: string) => void;
}

interface PlanItemProps {
  plan: Production;
  itemsMap: Record<string, Item>;
  baseId: string;
}

const PlanItem: React.FC<PlanItemProps> = ({ plan, itemsMap, baseId }) => {
  const planData = useSubscription<ProductionPlanRequirementsStatus>([
    SUB_IDS.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID,
    baseId,
    plan.id,
  ]);

  const { allRequirementsSatisfied, hasError, itemName, corporationName } = planData;

  const badgeClass = hasError
    ? 'badge-error'
    : plan.active
      ? (allRequirementsSatisfied ? 'badge-success' : 'badge-warning')
      : 'badge-dash';

  return (
    <div className="bg-base-300 rounded-lg px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{plan.name}</span>
            <span className={`badge badge-sm ${badgeClass}`}>
              {plan.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="flex items-center gap-1">
              <ItemImage
                itemId={plan.selectedItemId}
                item={itemsMap?.[plan.selectedItemId]}
                size="small"
                className="w-4 h-4"
              />
              <span className="text-xs text-base-content/80">{itemName}</span>
              <span className="text-xs text-base-content/60">{plan.targetAmount}/min</span>
            </div>
            {corporationName && (
              <>
                <span className="text-xs text-base-content/40">•</span>
                <span className="text-xs text-base-content/70">
                  {corporationName} Lv.{plan.corporationLevel?.level}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BaseCard: React.FC<BaseCardProps> = ({ base, onOpen, onRename, onDelete }) => {
  // Use parameterized subscriptions
  const stats = useSubscription<BaseDetailStats | null>([SUB_IDS.BASES_DETAIL_STATS_BY_BASE_ID, base.id]);
  const inputItems = useSubscription<BaseInputItem[]>([SUB_IDS.BASES_INPUT_ITEMS_BY_BASE_ID, base.id]);
  const outputItems = useSubscription<BaseOutputItem[]>([SUB_IDS.BASES_OUTPUT_ITEMS_BY_BASE_ID, base.id]);
  const defenseBuildings = useSubscription<BaseDefenseBuilding[]>([SUB_IDS.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, base.id]);

  // Get data for plans
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_BY_ID_MAP]);

  // Early return if stats not available
  if (!stats) {
    return null;
  }

  const { coreLevel, totalHeat, energyGeneration, energyConsumption, baseCoreHeatCapacity, heatPercentage, energyPercentage, isHeatOverCapacity, isEnergyInsufficient } = stats;

  // Calculate plan counts and prepare plan data
  const planSections = base.productions || [];

  return (
    <div className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow">
      <div className="card-body p-4 flex flex-col">
        <h3 className="card-title text-lg font-semibold mb-3">{base.name}</h3>
        {/* Row 1: Image | Base Info */}
        <div className="flex items-start gap-6 mb-4">
          <div className="flex-shrink-0 flex flex-col items-center">
            <img
              src="/icons/buildings/base_core.png"
              alt="Base Core"
              className="w-30 h-30 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <span className="badge badge-sm badge-outline mt-1">Lv.{coreLevel}</span>
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

        {/* Row 2: Production Plans */}
        {planSections.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="text-sm text-base-content/70 mb-1">Production Plans</div>
            <div className="space-y-2">
              {planSections.map((plan) => (
                <PlanItem
                  key={plan.id}
                  plan={plan}
                  itemsMap={itemsMap}
                  baseId={base.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Input Items, Output Items, and Defense */}
        {(inputItems.length > 0 || outputItems.length > 0 || defenseBuildings.length > 0) && (
          <div className="mb-4 space-y-3">
            {inputItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm text-base-content/70 mb-1">Input Items</div>
                <div className="flex flex-wrap gap-2">
                  {inputItems.map(({ item, ratePerMinute, baseBuildingId }) => (
                    <div
                      key={`input-${baseBuildingId}-${item.id}`}
                      className="flex items-center gap-1 px-2 py-1"
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
                  {outputItems.map(({ item, ratePerMinute, building }, index) => (
                    <div
                      key={`output-${building.id}-${item.id}-${index}`}
                      className="flex items-center gap-1 px-2 py-1"
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

        {/* Row 4: Controls (always at bottom) */}
        <div className="card-actions justify-end gap-2 mt-auto">
          <button
            className="btn btn-sm btn-primary btn-outline"
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
            className="btn btn-sm btn-error btn-dash"
            onClick={() => onDelete(base.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
