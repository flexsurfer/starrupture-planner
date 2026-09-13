import { appIds } from '@/app/uklad/catalog';
import React, { useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Base, BaseCardSectionKey, Item, Production } from '@/app/uklad/model';
import { ItemImage, BuildingImage } from '@/shared/ui';
import { EnergyGroupSelector } from '@/features/energy-groups/ui';
import type {
  AddBuildingRequest,
  BaseOutputItem,
  BaseDetailTab,
  BaseLogisticsViewModel,
  BuildingSectionType,
} from '@/features/bases/types';
import { isLogisticsExcludedOutputBuildingId, isRawExtractor } from '@/features/bases/building-section';
import { AddBuildingCardModal } from '../modals';
import { getPlanOutputAllocationSummary, resolveOutputBuilding } from '@/utils/planOutputAllocations';
import { getItemCategoryColor } from '@/utils/itemColors';

interface BaseCardProps {
  base: Base;
  onOpen: (baseId: string, tab?: BaseDetailTab) => void;
  onDelete: (baseId: string) => void;
}

interface PlanItemProps {
  plan: Production;
  itemsMap: Record<string, Item>;
  baseId: string;
  base: Base;
  logistics: BaseLogisticsViewModel | null;
  outputItems: BaseOutputItem[];
}

interface SectionHeaderProps {
  title: string;
  count?: number;
  onManage?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  count,
  onManage,
  onAdd,
  addLabel,
  isCollapsible = false,
  isCollapsed = false,
  onToggle,
}) => {
  const titleContent = (
    <>
      {isCollapsible && (
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-base-content/45 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7.5 4.5L13 10l-5.5 5.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="truncate text-xs font-medium text-base-content/60">{title}</span>
      {typeof count === 'number' && (
        <span className="shrink-0 text-[11px] tabular-nums text-base-content/45">{count}</span>
      )}
    </>
  );

  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      {isCollapsible ? (
        <button
          type="button"
          className="-mx-1 flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary"
          aria-expanded={!isCollapsed}
          onClick={onToggle}
        >
          {titleContent}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {titleContent}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {onManage && (
          <button
            type="button"
            className="btn btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/45 hover:text-base-content"
            aria-label={`Manage ${title}`}
            title={`Manage ${title}`}
            onClick={onManage}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M5 12h14M5 17h14M9 5v4m6 1v4m-6 1v4" />
            </svg>
          </button>
        )}
        {onAdd && addLabel && (
          <button
            type="button"
            className="btn btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/45 hover:text-base-content"
            aria-label={addLabel}
            title={addLabel}
            onClick={onAdd}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

const formatRate = (value: number | undefined): string => {
  if (!value || value <= 0) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const PlanItem: React.FC<PlanItemProps> = ({ plan, itemsMap, baseId, base, logistics, outputItems }) => {
  const planData = useSubscription([
    appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID,
    baseId,
    plan.id,
  ]);

  const { allRequirementsSatisfied, hasError, hasMaterialShortage, itemName, corporationName } = planData;
  const outputColor = getItemCategoryColor(itemsMap[plan.selectedItemId]?.type);

  const needsAttention = plan.active && (!allRequirementsSatisfied || hasMaterialShortage);
  const statusLabel = hasError ? 'Error' : !plan.active ? 'Inactive' : needsAttention ? 'Needs attention' : 'Active';
  const statusClass = hasError ? 'text-error' : needsAttention ? 'text-warning' : 'text-base-content/50';

  return (
    <div className="py-3">
      <div className="flex items-start gap-2.5">
        <ItemImage
          itemId={plan.selectedItemId}
          item={itemsMap?.[plan.selectedItemId]}
          size="small"
          className={`h-9 w-9 shrink-0 ${plan.active ? '' : 'opacity-50'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className={`min-w-0 flex-1 break-words text-sm font-semibold leading-snug ${plan.active ? 'text-base-content' : 'text-base-content/60'}`}>
              {itemName}
            </span>
            <span className={`shrink-0 whitespace-nowrap text-right text-lg font-semibold leading-tight tabular-nums sm:text-xl ${plan.active ? '' : 'opacity-60'}`} style={{ color: outputColor }} title="Target production rate">
              {plan.targetAmount}<span className="ml-0.5 text-xs font-normal">/min</span>
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="min-w-0 truncate text-base-content/50" title={plan.name}>{plan.name}</span>
            <span className={`inline-flex shrink-0 items-center gap-1 ${statusClass}`}>
              {(hasError || needsAttention) && (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01" />
                </svg>
              )}
              {statusLabel}
            </span>
            {corporationName && (
              <span className="text-base-content/50">{corporationName} Lv.{plan.corporationLevel?.level}</span>
            )}
          </div>
        </div>
      </div>
      {(() => {
        const outputSummary = getPlanOutputAllocationSummary(base, plan.id);
        const outputs = outputSummary?.outputs || [];
        if (!outputSummary || outputs.length === 0) return null;

        return (
          <details className="mt-2 text-[11px] text-base-content/50">
            <summary className="cursor-pointer rounded py-1 hover:text-base-content/75 focus-visible:outline-2 focus-visible:outline-primary">
              <span>Outputs · {formatRate(outputSummary.assignedRatePerMinute)}/min assigned</span>
              {outputSummary.remainingRatePerMinute > 0 && (
                <span> · {formatRate(outputSummary.remainingRatePerMinute)}/min left</span>
              )}
              {outputs.some((output) => output.isOverCapacity || output.isUnderSupplied) && (
                <span className="text-warning"> · Limited</span>
              )}
              <span className="sr-only">. Show output allocation details</span>
            </summary>
            <div className="mt-1 space-y-1 border-l border-base-content/10 pl-2">
              {outputs.slice(0, 3).map((output) => {
                const logisticsOutput = logistics?.outputs.find((entry) => entry.baseBuildingId === output.id);
                const outputItem = outputItems.find((entry) => entry.baseBuildingId === output.id);
                const linkedInputs = logisticsOutput?.linkedInputs || [];
                const targetLabel = linkedInputs.length === 1
                    ? linkedInputs[0].baseName
                    : linkedInputs.length > 1
                      ? `${linkedInputs.length} targets`
                      : '';
                const hasWarning = output.isOverCapacity || output.isUnderSupplied;
                const outputName = output.name || outputItem?.building.name || output.buildingTypeId;
                const hasCapacity = typeof output.capacityPerMinuteResolved === 'number' && Number.isFinite(output.capacityPerMinuteResolved);

                return (
                  <div
                    key={output.id}
                    className="flex flex-wrap items-center gap-2 py-1"
                  >
                    <BuildingImage
                      buildingId={output.buildingTypeId}
                      building={outputItem?.building}
                      size="small"
                      className="h-4 w-4 shrink-0 opacity-60"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] text-base-content/60" title={outputName}>
                        {outputName}
                      </div>
                      {(hasWarning || targetLabel) && (
                        <div
                          className={`truncate text-[10px] ${hasWarning ? 'text-warning' : 'text-base-content/50'}`}
                          title={linkedInputs.map((entry) => entry.baseName).join(', ')}
                        >
                          {hasWarning ? 'limited by source/capacity' : `to ${targetLabel}`}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11px] font-medium tabular-nums" style={{ color: outputColor }}>
                        {formatRate(output.effectiveRatePerMinute)}/min
                      </span>
                      {hasCapacity && (
                        <span className="font-mono text-[10px] text-base-content/50">
                          cap {formatRate(output.capacityPerMinuteResolved)}/min
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {outputs.length > 3 && (
                <div className="text-[11px] text-base-content/45">+{outputs.length - 3} more outputs</div>
              )}
            </div>
          </details>
        );
      })()}
    </div>
  );
};

export const BaseCard: React.FC<BaseCardProps> = ({ base, onOpen, onDelete }) => {
  const runtime = useRuntime();
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [addBuildingSection, setAddBuildingSection] = useState<BuildingSectionType | null>(null);

  // Use parameterized subscriptions
  const stats = useSubscription([appIds.subscriptions.BASES_DETAIL_STATS_BY_BASE_ID, base.id]);
  const inputItems = useSubscription([appIds.subscriptions.BASES_INPUT_ITEMS_BY_BASE_ID, base.id]);
  const outputItems = useSubscription([appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, base.id]);
  const defenseBuildings = useSubscription([appIds.subscriptions.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, base.id]);
  const logistics = useSubscription([appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, base.id]);
  const collapsedSections = useSubscription([
    appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID,
    base.id,
  ]);

  // Get data for plans
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);

  // Early return if stats not available
  if (!stats) {
    return null;
  }

  const { coreLevel, totalHeat, energyGeneration, energyConsumption, energyGridConsumption, baseCoreHeatCapacity, heatPercentage, energyPercentage, isHeatOverCapacity, isEnergyInsufficient, energyGroupId, energyGroupName } = stats;

  // Calculate plan counts and prepare plan data
  const planSections = base.productions || [];
  const handleOpenAddModal = (sectionType: BuildingSectionType) => {
    setAddBuildingSection(sectionType);
    setShowAddBuildingModal(true);
  };
  const handleCloseAddModal = () => {
    setShowAddBuildingModal(false);
    setAddBuildingSection(null);
  };
  const handleAddBuilding = (request: AddBuildingRequest) => {
    if (!addBuildingSection) return;
    runtime.dispatch([
      appIds.events.BASES_ADD_BUILDINGS,
      base.id,
      request.buildingTypeId,
      addBuildingSection,
      request.count,
      request.name,
      request.description,
      request.selectedItemId ?? null,
      request.ratePerMinute ?? null,
      request.linkedOutput ?? null,
      request.sourceProductionId ?? null,
      request.allocationMode ?? null,
      request.requestedRatePerMinute ?? null,
      request.capacityPerMinute ?? null,
      request.priority ?? null,
      request.linkedInputRef ?? null,
    ]);
    handleCloseAddModal();
  };
  const handleAddInput = () => {
    handleOpenAddModal('inputs');
  };
  const handleAddOutput = () => {
    handleOpenAddModal('outputs');
  };
  const handleAddPlan = () => {
    runtime.dispatch([appIds.events.BASES_OPEN_BASE, base.id, 'plans']);
    runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
  };
  const isSectionCollapsed = (sectionKey: BaseCardSectionKey) => {
    return collapsedSections?.[sectionKey] ?? sectionKey !== 'productionPlans';
  };
  const toggleSection = (sectionKey: BaseCardSectionKey) => {
    runtime.dispatch([appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED, base.id, sectionKey]);
  };

  const isProductionPlansCollapsed = isSectionCollapsed('productionPlans');
  const isOutputsCollapsed = isSectionCollapsed('outputs');
  const isInputsCollapsed = isSectionCollapsed('inputs');
  const isDefenseCollapsed = isSectionCollapsed('defense');

  return (
    <>
      <div className="card h-full border border-base-300 bg-base-200">
        <div className="card-body flex min-w-0 flex-col gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/icons/buildings/base_core.webp"
              alt="Base Core"
              className="size-8 shrink-0 object-contain opacity-60"
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-base-content/75" title={base.name}>{base.name}</h3>
              <div className="mt-0.5 text-[11px] text-base-content/50">
                Lv.{coreLevel + 1} · {base.buildings.length} buildings
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div>
              <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${isHeatOverCapacity ? 'text-error' : 'text-base-content/50'}`}>
                <span>Heat{isHeatOverCapacity ? ' · Over capacity' : ''}</span>
                <span className="font-mono tabular-nums">{totalHeat} / {baseCoreHeatCapacity}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-base-content/10">
                <div
                  className={`h-full rounded-full ${isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
                  style={{ width: `${heatPercentage}%` }}
                />
              </div>
            </div>
            <div>
              <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${isEnergyInsufficient ? 'text-error' : 'text-base-content/50'}`}>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate" title={energyGroupName}>
                    Energy{energyGroupName ? ` [${energyGroupName}]` : ''}{isEnergyInsufficient ? ' · Insufficient' : ''}
                  </span>
                  <EnergyGroupSelector baseId={base.id} currentGroupId={energyGroupId} variant="icon" />
                </div>
                <span className="font-mono tabular-nums">
                  {energyConsumption}
                  {energyGroupId && <span> ({energyGridConsumption})</span>}
                  {' / '}{energyGeneration} MW
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-base-content/10">
                <div
                  className={`h-full rounded-full ${isEnergyInsufficient ? 'bg-error' : 'bg-success'}`}
                  style={{ width: `${energyPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-base-content/5 pt-2">
            <SectionHeader
              title="Production Plans"
              count={planSections.length}
              onManage={() => onOpen(base.id, 'plans')}
              onAdd={handleAddPlan}
              addLabel="Add Plan"
              isCollapsible
              isCollapsed={isProductionPlansCollapsed}
              onToggle={() => toggleSection('productionPlans')}
            />
            {!isProductionPlansCollapsed && (
              planSections.length === 0 ? (
                <div className="py-3 text-xs text-base-content/50">
                  No production plans yet.
                </div>
              ) : (
                <div className="divide-y divide-base-content/5">
                  {planSections.map((plan) => (
                    <PlanItem
                      key={plan.id}
                      plan={plan}
                      itemsMap={itemsMap}
                      baseId={base.id}
                      base={base}
                      logistics={logistics}
                      outputItems={outputItems}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          <div className="border-t border-base-content/5 pt-2">
            <SectionHeader
              title="Outputs"
              count={outputItems.length}
              onManage={() => onOpen(base.id, 'buildings')}
              onAdd={handleAddOutput}
              addLabel="Add Output"
              isCollapsible
              isCollapsed={isOutputsCollapsed}
              onToggle={() => toggleSection('outputs')}
            />
            {!isOutputsCollapsed && (
              outputItems.length === 0 ? (
                <div className="py-3 text-xs text-base-content/50">
                  No outputs configured yet.
                </div>
              ) : (
                <div className="divide-y divide-base-content/5">
                  {outputItems.map(({ item, ratePerMinute, baseBuildingId, name, building }) => {
                    const outputName = name && name !== building.name ? name : building.name;
                    const sourceOutput = base.buildings.find((baseBuilding) => baseBuilding.id === baseBuildingId);
                    const resolvedOutput = sourceOutput ? resolveOutputBuilding(sourceOutput, base) : null;
                    const sourcePlanName = resolvedOutput?.sourceProduction?.name;
                    const capacityPerMinute = resolvedOutput?.capacityPerMinuteResolved;
                    const isPlanLinked = !!sourcePlanName;
                    const isExcluded = isLogisticsExcludedOutputBuildingId(building.id);
                    const logisticsOutput = !isExcluded
                      ? logistics?.outputs.find((o) => o.baseBuildingId === baseBuildingId)
                      : undefined;
                    const linkedInputs = logisticsOutput?.linkedInputs || [];
                    const hasTargets = linkedInputs.length > 0;
                    const hasBrokenTarget = linkedInputs.some(
                      (l) => l.linkedOutputStatus && l.linkedOutputStatus !== 'ok'
                    );
                    const hasAllocationWarning = !!resolvedOutput?.isOverCapacity || !!resolvedOutput?.isUnderSupplied;

                    return (
                      <div
                        key={`output-${baseBuildingId}`}
                        className="flex items-start gap-2.5 py-3 text-xs"
                      >
                        <ItemImage itemId={item.id} item={item} size="small" className="h-8 w-8 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="min-w-0 flex-1 break-words text-sm font-semibold text-base-content">{item.name}</span>
                            <span className="shrink-0 whitespace-nowrap text-right text-lg font-semibold leading-tight tabular-nums sm:text-xl" style={{ color: getItemCategoryColor(item.type) }}>
                              {formatRate(ratePerMinute)}<span className="ml-0.5 text-xs font-normal">/min</span>
                            </span>
                          </div>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-base-content/50">
                            <span className="truncate" title={outputName}>{outputName}</span>
                            {isPlanLinked && (
                              <span className="font-mono text-[10px]">
                                cap {formatRate(capacityPerMinute)}/min
                              </span>
                            )}
                            {isPlanLinked ? (
                              <span className="truncate" title={sourcePlanName}>
                                {sourcePlanName}
                              </span>
                            ) : (
                              <span>Manual</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            {hasAllocationWarning && <span className="text-warning">Limited by source/capacity</span>}
                            {!isExcluded && (
                              <>
                                {hasBrokenTarget && (
                                  <span className="text-error">Broken link</span>
                                )}
                                {hasTargets && !hasBrokenTarget && (
                                  <span
                                    className="truncate text-base-content/50"
                                    title={linkedInputs.map((l) => `${l.baseName} (${l.ratePerMinute || 0}/min)`).join(', ')}
                                  >
                                    → {linkedInputs.length === 1
                                      ? linkedInputs[0].baseName
                                      : `${linkedInputs.length} bases`}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <div className="border-t border-base-content/5 pt-2">
            <SectionHeader
              title="Inputs"
              count={inputItems.length}
              onManage={() => onOpen(base.id, 'buildings')}
              onAdd={handleAddInput}
              addLabel="Add Input"
              isCollapsible
              isCollapsed={isInputsCollapsed}
              onToggle={() => toggleSection('inputs')}
            />
            {!isInputsCollapsed && (
              inputItems.length === 0 ? (
                <div className="py-3 text-xs text-base-content/50">
                  No inputs configured yet.
                </div>
              ) : (
                <div className="divide-y divide-base-content/5">
                  {inputItems.map(({ item, ratePerMinute, baseBuildingId, name, building, linkedOutput }) => {
                    const displayName = name && name !== building.name ? name : item.name;
                    const supportsLinking = !isRawExtractor(building);
                    const isLinked = !!linkedOutput;
                    const isOk = linkedOutput?.status === 'ok';
                    const isBroken = isLinked && !isOk;
                    return (
                      <div
                        key={`input-${baseBuildingId}`}
                        className="flex flex-wrap items-center gap-2 py-2 text-xs"
                      >
                        <ItemImage itemId={item.id} item={item} size="small" className="h-6 w-6 shrink-0 opacity-65" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base-content/65" title={displayName}>{displayName}</div>
                          <div className="text-xs font-medium tabular-nums" style={{ color: getItemCategoryColor(item.type) }}>{ratePerMinute}/min</div>
                        </div>
                        {supportsLinking && (
                          <div className="flex shrink-0 justify-end">
                            {isBroken && (
                              <span
                                className="text-[11px] text-error"
                                title={`Broken link: ${linkedOutput.baseName} → ${linkedOutput.outputName} (${linkedOutput.status})`}
                              >
                                Broken link
                              </span>
                            )}
                            {isLinked && !isBroken && (
                              <span
                                className="max-w-[100px] truncate text-[11px] text-base-content/50"
                                title={`${linkedOutput.baseName} → ${linkedOutput.outputName}`}
                              >
                                ← {linkedOutput.baseName}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex w-8 shrink-0 justify-center">
                          <BuildingImage
                            buildingId={building.id}
                            building={building}
                            size="small"
                            className="h-5 w-5 opacity-50"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {defenseBuildings.length > 0 && (
            <div className="border-t border-base-content/5 pt-2">
              <SectionHeader
                title="Defense"
                count={defenseBuildings.length}
                onManage={() => onOpen(base.id, 'buildings')}
                isCollapsible
                isCollapsed={isDefenseCollapsed}
                onToggle={() => toggleSection('defense')}
              />
              {!isDefenseCollapsed && (
                <div className="flex flex-wrap gap-2">
                  {defenseBuildings.map(({ building, count }) => (
                    <div
                      key={building.id}
                      className="flex items-center gap-1 py-1 text-base-content/60"
                      title={`${building.name}${count > 1 ? ` (${count})` : ''}`}
                    >
                      <BuildingImage
                        buildingId={building.id}
                        building={building}
                        size="small"
                      />
                      <span className="text-xs font-medium">{building.name}</span>
                      {count > 1 && (
                        <span className="text-xs text-base-content/60">×{count}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-base-content/5 pt-3">
            <button
              type="button"
              className="btn btn-sm btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/55 hover:bg-error/10 hover:text-error"
              aria-label={`Delete ${base.name}`}
              title="Delete Base"
              onClick={() => onDelete(base.id)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15m-13.5 0 .75 13.5h10.5L18 6.75M9 6.75v-3h6v3M10 10.5v6M14 10.5v6" />
              </svg>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary btn-outline h-8 min-h-8 min-w-8 shrink-0 gap-1 px-2 text-xs"
              onClick={() => onOpen(base.id)}
            >
              Open
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {addBuildingSection && (
        <AddBuildingCardModal
          isOpen={showAddBuildingModal}
          sectionType={addBuildingSection}
          baseId={base.id}
          onClose={handleCloseAddModal}
          onAdd={handleAddBuilding}
          requireItemConfiguration
        />
      )}
    </>
  );
};
