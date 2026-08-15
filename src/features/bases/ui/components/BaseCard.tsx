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
      <span className="truncate text-sm font-semibold text-base-content/80">{title}</span>
      {typeof count === 'number' && (
        <span className="badge badge-ghost badge-xs shrink-0">{count}</span>
      )}
    </>
  );

  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      {isCollapsible ? (
        <button
          type="button"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-base-300/25 focus:outline-none focus-visible:ring-1 focus-visible:ring-base-content/20"
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
            className="btn btn-xs btn-ghost text-base-content/65"
            onClick={onManage}
          >
            Manage
          </button>
        )}
        {onAdd && addLabel && (
          <button
            type="button"
            className="btn btn-xs btn-ghost text-base-content/65"
            onClick={onAdd}
          >
            {addLabel}
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

  const badgeClass = hasError
    ? 'badge-error'
    : plan.active
      ? (allRequirementsSatisfied && !hasMaterialShortage ? 'badge-success' : 'badge-warning')
      : 'badge-dash';

  return (
    <div
      className={`rounded-md border px-2.5 py-1.5 transition-colors ${
        hasError
          ? 'border-error/35 bg-error/10'
          : plan.active
            ? 'border-base-300/60 bg-base-100/50'
      : 'border-base-300/60 bg-base-200/35'
  }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold leading-tight" title={plan.name}>{plan.name}</span>
            <span className={`badge badge-xs shrink-0 ${badgeClass}`}>
              {plan.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <ItemImage
                itemId={plan.selectedItemId}
                item={itemsMap?.[plan.selectedItemId]}
                size="small"
                className="w-5 h-5 shrink-0"
              />
              <span className="truncate text-base-content/80" title={itemName}>{itemName}</span>
              <span className="shrink-0 rounded bg-base-300/70 px-1.5 py-0.5 font-mono text-base-content/65">
                {plan.targetAmount}/min
              </span>
            </div>
            {corporationName && (
              <>
                <span className="text-base-content/35">•</span>
                <span className="shrink-0 text-base-content/60">
                  {corporationName} Lv.{plan.corporationLevel?.level}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {(() => {
        const outputSummary = getPlanOutputAllocationSummary(base, plan.id);
        const outputs = outputSummary?.outputs || [];
        if (!outputSummary || outputs.length === 0) return null;

        return (
          <div className="mt-2 rounded-md border border-base-300/45 bg-base-100/35 px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-base-content/70">Outputs</span>
              <span className="font-mono text-base-content/55" title={`${formatRate(outputSummary.producedRatePerMinute)}/min produced`}>
                {formatRate(outputSummary.assignedRatePerMinute)}/min assigned
                {outputSummary.remainingRatePerMinute > 0 && (
                  <span className="text-warning"> · {formatRate(outputSummary.remainingRatePerMinute)}/min left</span>
                )}
              </span>
            </div>
            <div className="space-y-1">
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
                    className="flex items-center gap-2 rounded border border-base-300/40 bg-base-100/35 px-2 py-1.5"
                  >
                    <BuildingImage
                      buildingId={output.buildingTypeId}
                      building={outputItem?.building}
                      size="small"
                      className="h-5 w-5 shrink-0 rounded opacity-85"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-base-content/75" title={outputName}>
                        {outputName}
                      </div>
                      {(hasWarning || targetLabel) && (
                        <div
                          className={`truncate text-[10px] ${targetLabel && !hasWarning ? 'text-info' : 'text-base-content/45'}`}
                          title={linkedInputs.map((entry) => entry.baseName).join(', ')}
                        >
                          {hasWarning ? 'limited by source/capacity' : `to ${targetLabel}`}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-mono text-[11px] text-base-content/75">
                        {formatRate(output.effectiveRatePerMinute)}/min
                      </span>
                      {hasCapacity && (
                        <span className="rounded bg-base-200/70 px-1.5 py-0.5 font-mono text-[10px] text-base-content/50">
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
          </div>
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
      <div className="card h-full overflow-hidden border border-base-300/70 bg-base-100 shadow-sm transition-shadow hover:shadow-md">
        <div className="card-body flex flex-col gap-3 p-4">
          <div className="rounded-lg border border-base-300/40 bg-base-200/40 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold leading-tight" title={base.name}>{base.name}</h3>
                <div className="mt-1 text-xs text-base-content/55">{base.buildings.length} buildings</div>
              </div>
              <span className="badge badge-sm badge-outline shrink-0">Lv.{coreLevel}</span>
            </div>

            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
              <img
                src="/icons/buildings/base_core.webp"
                alt="Base Core"
                className="h-16 w-16 object-contain opacity-90"
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />

              <div className="min-w-0 space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={isHeatOverCapacity ? 'text-error' : 'text-base-content/65'}>Heat</span>
                    <span className={`shrink-0 font-mono font-medium ${isHeatOverCapacity ? 'text-error' : 'text-base-content/90'}`}>
                      {totalHeat} / {baseCoreHeatCapacity}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-300/70">
                    <div
                      className={`h-full rounded-full transition-all ${isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
                      style={{ width: `${heatPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className={`flex min-w-0 items-center gap-1 ${isEnergyInsufficient ? 'text-error' : 'text-base-content/65'}`}>
                      <span className="truncate">Energy{energyGroupName ? ` [${energyGroupName}]` : ''}</span>
                      <EnergyGroupSelector baseId={base.id} currentGroupId={energyGroupId} variant="text" />
                    </div>
                    <span className={`shrink-0 font-mono font-medium ${isEnergyInsufficient ? 'text-error' : 'text-base-content/90'}`}>
                      {energyConsumption}
                      {energyGroupId && (
                        <span className="text-base-content/55"> ({energyGridConsumption})</span>
                      )}
                      {' / '}
                      {energyGeneration} MW
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-300/70">
                    <div
                      className={`h-full rounded-full transition-all ${isEnergyInsufficient ? 'bg-error' : 'bg-success'}`}
                      style={{ width: `${energyPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-base-300/50 pt-2">
              <button
                className="btn btn-xs btn-ghost text-base-content/55 hover:bg-error/10 hover:text-error"
                onClick={() => onDelete(base.id)}
              >
                Delete
              </button>
              <button
                className="btn btn-xs btn-primary"
                onClick={() => onOpen(base.id)}
              >
                Open
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-l-2 border-base-300/40 border-l-emerald-400/20 bg-base-200/25 p-2.5">
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
                <div className="rounded-md border border-dashed border-base-300/70 bg-base-100/40 px-3 py-1.5 text-xs text-base-content/60">
                  No production plans yet.
                </div>
              ) : (
                <div className="space-y-1">
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

          <div className="rounded-lg border border-l-2 border-base-300/40 border-l-violet-400/20 bg-base-200/25 p-2.5">
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
                <div className="rounded-md border border-dashed border-base-300/70 bg-base-100/40 px-3 py-1.5 text-xs text-base-content/60">
                  No outputs configured yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {outputItems.map(({ item, ratePerMinute, baseBuildingId, name, building }) => {
                    const displayName = name && name !== building.name ? name : item.name;
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
                    const rateLabel = `${formatRate(ratePerMinute)}/min`;

                    return (
                      <div
                        key={`output-${baseBuildingId}`}
                        className={`flex min-h-[48px] items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                          hasBrokenTarget
                            ? 'border-error/35 bg-error/10'
                            : hasAllocationWarning
                              ? 'border-base-300/40 bg-base-100/50'
                              : 'border-base-300/50 bg-base-100/50'
                        }`}
                      >
                        <ItemImage itemId={item.id} item={item} size="small" className="h-6 w-6 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-base-content/90" title={displayName}>{displayName}</div>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="font-mono text-[11px] text-base-content/55">{rateLabel}</span>
                            {isPlanLinked && (
                              <span className="shrink-0 rounded bg-base-200/70 px-1.5 py-0.5 font-mono text-[10px] text-base-content/55">
                                cap {formatRate(capacityPerMinute)}/min
                              </span>
                            )}
                            {isPlanLinked ? (
                              <span className="truncate text-[11px] text-base-content/55" title={sourcePlanName}>
                                {sourcePlanName}
                              </span>
                            ) : (
                              <span className="text-[11px] text-base-content/35">Manual</span>
                            )}
                          </div>
                        </div>
                        {!isExcluded && (
                          <div className="flex min-w-[78px] shrink-0 justify-end">
                            {hasBrokenTarget && (
                              <span className="badge badge-error badge-xs">Broken link</span>
                            )}
                            {hasTargets && !hasBrokenTarget && (
                              <span
                                className="max-w-[128px] truncate rounded-full bg-info/10 px-2 py-0.5 text-[11px] text-info"
                                title={linkedInputs.map((l) => `${l.baseName} (${l.ratePerMinute || 0}/min)`).join(', ')}
                              >
                                → {linkedInputs.length === 1
                                  ? linkedInputs[0].baseName
                                  : `${linkedInputs.length} bases`}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex w-8 shrink-0 justify-center">
                          <BuildingImage
                            buildingId={building.id}
                            building={building}
                            size="small"
                            className="h-5 w-5 rounded opacity-80"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <div className="rounded-lg border border-l-2 border-base-300/40 border-l-sky-400/20 bg-base-200/25 p-2.5">
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
                <div className="rounded-md border border-dashed border-base-300/70 bg-base-100/40 px-3 py-1.5 text-xs text-base-content/60">
                  No inputs configured yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {inputItems.map(({ item, ratePerMinute, baseBuildingId, name, building, linkedOutput }) => {
                    const displayName = name && name !== building.name ? name : item.name;
                    const supportsLinking = !isRawExtractor(building);
                    const isLinked = !!linkedOutput;
                    const isOk = linkedOutput?.status === 'ok';
                    const isBroken = isLinked && !isOk;
                    return (
                      <div
                        key={`input-${baseBuildingId}`}
                        className={`flex min-h-[42px] items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                          isBroken ? 'border-error/35 bg-error/10' : 'border-base-300/50 bg-base-100/50'
                        }`}
                      >
                        <ItemImage itemId={item.id} item={item} size="small" className="h-6 w-6 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-base-content/90" title={displayName}>{displayName}</div>
                          <div className="font-mono text-[11px] text-base-content/55">{ratePerMinute}/min</div>
                        </div>
                        {supportsLinking && (
                          <div className="flex min-w-[78px] shrink-0 justify-end">
                            {isBroken && (
                              <span
                                className="badge badge-error badge-xs"
                                title={`Broken link: ${linkedOutput.baseName} → ${linkedOutput.outputName} (${linkedOutput.status})`}
                              >
                                Broken link
                              </span>
                            )}
                            {isLinked && !isBroken && (
                              <span
                                className="max-w-[120px] truncate rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success"
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
                            className="h-5 w-5 rounded opacity-80"
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
            <div className="rounded-lg border border-l-2 border-base-300/40 border-l-amber-400/20 bg-base-200/25 p-2.5">
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
                      className="flex items-center gap-1 rounded-md border border-base-300/50 bg-base-100/50 px-2 py-1"
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
              )}
            </div>
          )}
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
