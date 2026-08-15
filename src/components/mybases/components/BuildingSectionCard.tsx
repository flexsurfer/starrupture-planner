import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useMemo, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Base, BaseBuilding, Building, Item } from '@/app/uklad/model';
import type { BuildingSectionBuilding, LinkableOutputItem } from '@/features/bases/types';
import { isLogisticsExcludedOutputBuildingId, isRawExtractor } from '@/features/bases/building-section';
import { sanitizeBuildingCount } from '@/features/bases/building-counts';
import { BuildingImage, ClippedSelect, ItemImage } from '../../ui';
import { SelectItemModal } from '../modals';
import { BuildingCountControl } from './BuildingCountControl';
import { resolveInputBuilding, resolveLinkedOutput } from '../../../utils/productionPlanInputs';
import type { ResolvedInputBuilding } from '../../../utils/productionPlanInputs';
import { resolveOutputBuilding } from '../../../utils/planOutputAllocations';
import type { ResolvedOutputBuilding } from '../../../utils/planOutputAllocations';

interface LinkedInputData {
  resolved: ResolvedInputBuilding;
  hasError: boolean;
  label: string;
}

/**
 * Subscribes to BASES_LIST only when rendered by input-link controls.
 * Keeps the parent BuildingSectionCard free from that subscription.
 */
const useLinkedInputData = (baseBuilding: BaseBuilding): LinkedInputData => {
  const allBases = useSubscription([appIds.subscriptions.BASES_LIST]) || [];
  const buildingsById = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);

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

interface LinkedInputItemButtonProps {
  baseBuilding: BaseBuilding;
}

const LinkedInputItemButton: React.FC<LinkedInputItemButtonProps> = ({ baseBuilding }) => {
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const { resolved, hasError, label } = useLinkedInputData(baseBuilding);
  const selectedItem = resolved.selectedItemId ? itemsMap[resolved.selectedItemId] : null;

  return (
    <div
      className={`flex-shrink-0 w-20 min-h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 bg-base-100 px-1 ${
        hasError ? 'border-error' : 'border-base-300'
      }`}
      title={`${hasError ? 'Broken linked output' : 'Linked output'}: ${label}`}
    >
      {selectedItem ? (
        <>
          <ItemImage
            itemId={selectedItem.id}
            item={selectedItem}
            size="small"
            className="w-8 h-8"
          />
          <span className="text-xs text-center">{formatRate(resolved.ratePerMinute)}/min</span>
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
    </div>
  );
};

function formatRate(value: number | undefined): string {
  if (!value || value <= 0) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getLinkableOutputKey(baseId: string, baseBuildingId: string): string {
  return `${baseId}:${baseBuildingId}`;
}

function isConfiguredPositiveRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function useLinkableOutputs(currentBaseId: string): LinkableOutputItem[] {
  const subscribedBases = useSubscription([appIds.subscriptions.BASES_LIST]);
  const buildingsById = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);
  const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);

  return useMemo(() => {
    const allBases = subscribedBases || [];
    const outputs: LinkableOutputItem[] = [];

    for (const base of allBases) {
      for (const output of base.buildings) {
        if (output.sectionType !== 'outputs') continue;
        if (isLogisticsExcludedOutputBuildingId(output.buildingTypeId)) continue;

        const resolvedOutput = resolveOutputBuilding(output, base);
        if (!resolvedOutput.selectedItemId || !isConfiguredPositiveRate(resolvedOutput.ratePerMinute)) continue;

        const building = buildingsById[output.buildingTypeId];
        if (!building) continue;

        const item = itemsById[resolvedOutput.selectedItemId] || {
          id: resolvedOutput.selectedItemId,
          name: resolvedOutput.selectedItemId,
          type: 'unknown',
        };

        outputs.push({
          baseId: base.id,
          baseName: base.name,
          isCurrentBase: base.id === currentBaseId,
          baseBuildingId: output.id,
          item,
          ratePerMinute: resolvedOutput.ratePerMinute,
          building,
          name: output.name || building.name || item.name,
          description: output.description || '',
        });
      }
    }

    return outputs.sort((left, right) => {
      if (left.isCurrentBase !== right.isCurrentBase) return left.isCurrentBase ? -1 : 1;
      const baseDelta = left.baseName.localeCompare(right.baseName);
      if (baseDelta !== 0) return baseDelta;
      return left.item.name.localeCompare(right.item.name);
    });
  }, [subscribedBases, buildingsById, currentBaseId, itemsById]);
}

interface InputOutputLinkControlsProps {
  baseId: string;
  baseBuilding: BaseBuilding;
}

const InputOutputLinkControls: React.FC<InputOutputLinkControlsProps> = ({ baseId, baseBuilding }) => {
  const runtime = useRuntime();
  const outputs = useLinkableOutputs(baseId);
  const { resolved, hasError, label } = useLinkedInputData(baseBuilding);
  const linkedOutput = baseBuilding.linkedOutput;
  const selectedOutputKey = linkedOutput
    ? getLinkableOutputKey(linkedOutput.baseId, linkedOutput.buildingId)
    : '';
  const selectedOutput = selectedOutputKey
    ? outputs.find((output) => getLinkableOutputKey(output.baseId, output.baseBuildingId) === selectedOutputKey) || null
    : null;
  const selectedOutputExists = !selectedOutputKey || outputs.some((output) =>
    getLinkableOutputKey(output.baseId, output.baseBuildingId) === selectedOutputKey
  );
  const selectedOutputLabel = selectedOutput
    ? `${selectedOutput.baseName} / ${selectedOutput.name || selectedOutput.item.name}`
    : linkedOutput
    ? (hasError ? 'Broken link' : label)
    : 'Manual';

  const handleSourceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextKey = event.target.value;
    if (!nextKey) {
      runtime.dispatch([
        appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
        baseId,
        baseBuilding.id,
        resolved.selectedItemId || null,
        isConfiguredPositiveRate(resolved.ratePerMinute) ? resolved.ratePerMinute : null,
      ]);
      return;
    }

    const output = outputs.find((candidate) =>
      getLinkableOutputKey(candidate.baseId, candidate.baseBuildingId) === nextKey
    );
    if (!output) return;

    runtime.dispatch([
      appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
      baseId,
      baseBuilding.id,
      output.baseId,
      output.baseBuildingId,
    ]);
  };

  return (
    <div className="rounded-md border border-base-300/70 bg-base-100/55 p-2 space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[11px] text-base-content/60 shrink-0">Source</span>
        <ClippedSelect
          value={selectedOutputKey}
          onChange={handleSourceChange}
          displayValue={selectedOutputLabel}
          title={linkedOutput ? label : 'Manual'}
        >
          <option className="text-base-content bg-base-100" value="">Manual</option>
          {!selectedOutputExists && linkedOutput && (
            <option className="text-base-content bg-base-100" value={selectedOutputKey}>
              {hasError ? 'Broken link' : label}
            </option>
          )}
          {outputs.map((output) => {
            const key = getLinkableOutputKey(output.baseId, output.baseBuildingId);
            const displayName = output.name || output.item.name;
            return (
              <option className="text-base-content bg-base-100" key={key} value={key}>
                {output.baseName} / {displayName}
              </option>
            );
          })}
        </ClippedSelect>
      </div>
    </div>
  );
};

interface LinkableInputItem {
  baseId: string;
  baseName: string;
  baseBuildingId: string;
  building: Building;
  name: string;
  description: string;
  item?: Item;
  ratePerMinute?: number;
  linkedOutput?: {
    status: string;
    baseId: string;
    buildingId: string;
    baseName: string;
    outputName: string;
  };
}

function useLinkableInputs(currentBaseId: string): LinkableInputItem[] {
  const subscribedBases = useSubscription([appIds.subscriptions.BASES_LIST]);
  const buildingsById = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);
  const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);

  return useMemo(() => {
    const allBases = subscribedBases || [];
    const inputs: LinkableInputItem[] = [];

    for (const base of allBases) {
      for (const input of base.buildings) {
        if (input.sectionType !== 'inputs') continue;
        const building = buildingsById[input.buildingTypeId];
        if (!building || isRawExtractor(building)) continue;

        const resolvedInput = resolveInputBuilding(input, allBases);
        const itemId = resolvedInput.selectedItemId || input.linkedOutput?.itemIdSnapshot;
        const item = itemId ? itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' } : undefined;
        const resolution = input.linkedOutput ? resolveLinkedOutput(input, allBases) : null;
        const sourceOutputBuilding = resolution?.sourceOutput
          ? buildingsById[resolution.sourceOutput.buildingTypeId]
          : null;

        inputs.push({
          baseId: base.id,
          baseName: base.name,
          baseBuildingId: input.id,
          building,
          name: input.name || building.name,
          description: input.description || '',
          item,
          ratePerMinute: resolvedInput.ratePerMinute || input.linkedOutput?.ratePerMinuteSnapshot,
          linkedOutput: input.linkedOutput
            ? {
                status: resolution?.status || 'missing-output',
                baseId: input.linkedOutput.baseId,
                buildingId: input.linkedOutput.buildingId,
                baseName: resolution?.sourceBase?.name || 'Missing base',
                outputName:
                  resolution?.sourceOutput?.name ||
                  sourceOutputBuilding?.name ||
                  input.linkedOutput.buildingId,
              }
            : undefined,
        });
      }
    }

    return inputs.sort((left, right) => {
      const currentBaseDelta = Number(right.baseId === currentBaseId) - Number(left.baseId === currentBaseId);
      if (currentBaseDelta !== 0) return currentBaseDelta;
      const baseDelta = left.baseName.localeCompare(right.baseName);
      if (baseDelta !== 0) return baseDelta;
      return left.name.localeCompare(right.name);
    });
  }, [subscribedBases, buildingsById, currentBaseId, itemsById]);
}

interface OutputInputLinkControlsProps {
  baseId: string;
  baseBuilding: BaseBuilding;
}

const OutputInputLinkControls: React.FC<OutputInputLinkControlsProps> = ({
  baseId,
  baseBuilding,
}) => {
  const runtime = useRuntime();
  const inputs = useLinkableInputs(baseId);
  const linkedInputs = inputs.filter((input) =>
    input.linkedOutput?.baseId === baseId &&
    input.linkedOutput?.buildingId === baseBuilding.id
  );
  const linkedInput = linkedInputs[0] || null;
  const selectedInputKey = linkedInput
    ? getLinkableOutputKey(linkedInput.baseId, linkedInput.baseBuildingId)
    : '';
  const selectedInputLabel = linkedInput
    ? `${linkedInput.baseName} / ${linkedInput.name}`
    : 'No target';

  const handleTargetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextKey = event.target.value;
    if (!nextKey) {
      linkedInputs.forEach(handleRemoveInput);
      return;
    }

    const input = inputs.find((candidate) =>
      getLinkableOutputKey(candidate.baseId, candidate.baseBuildingId) === nextKey
    );
    if (!input) return;

    runtime.dispatch([
      appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
      input.baseId,
      input.baseBuildingId,
      baseId,
      baseBuilding.id,
    ]);
  };

  const handleRemoveInput = (input: LinkableInputItem) => {
    runtime.dispatch([
      appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
      input.baseId,
      input.baseBuildingId,
      input.item?.id || null,
      isConfiguredPositiveRate(input.ratePerMinute) ? input.ratePerMinute : null,
    ]);
  };

  if (isLogisticsExcludedOutputBuildingId(baseBuilding.buildingTypeId)) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[11px] text-base-content/60 shrink-0">Target</span>
        <ClippedSelect
          value={selectedInputKey}
          onChange={handleTargetChange}
          displayValue={selectedInputLabel}
          title={linkedInput ? `${linkedInput.baseName} / ${linkedInput.name}` : 'No target'}
        >
          <option className="text-base-content bg-base-100" value="">No target</option>
          {inputs.map((input) => {
            const key = getLinkableOutputKey(input.baseId, input.baseBuildingId);
            const linkedElsewhere = input.linkedOutput
              ? ` · linked to ${input.linkedOutput.baseName} / ${input.linkedOutput.outputName}`
              : '';
            return (
              <option className="text-base-content bg-base-100" key={key} value={key}>
                {input.baseName} / {input.name}{linkedElsewhere}
              </option>
            );
          })}
        </ClippedSelect>
      </div>
    </div>
  );
};

interface OutputPlanLinkControlsProps {
  baseId: string;
  base: Base | null;
  baseBuilding: BaseBuilding;
  resolvedOutput: ResolvedOutputBuilding;
}

const OutputPlanLinkControls: React.FC<OutputPlanLinkControlsProps> = ({
  baseId,
  base,
  baseBuilding,
  resolvedOutput,
}) => {
  const runtime = useRuntime();
  const plans = base?.productions || [];
  const isPlanLinked = !!baseBuilding.sourceProductionId;
  const selectedPlanId = baseBuilding.sourceProductionId || '';
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const selectedPlanLabel = selectedPlan?.name || 'Manual';

  const updatePlanLink = (payload: {
    sourceProductionId?: string | null;
    capacityPerMinute?: number | null;
    priority?: number | null;
  }) => {
    const hasSourceProductionId = Object.prototype.hasOwnProperty.call(payload, 'sourceProductionId');
    runtime.dispatch([
      appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
      baseId,
      baseBuilding.id,
      {
        sourceProductionId: (hasSourceProductionId ? payload.sourceProductionId : selectedPlanId) || null,
        allocationMode: 'auto',
        capacityPerMinute: payload.capacityPerMinute ?? baseBuilding.capacityPerMinute ?? null,
        priority: payload.priority ?? baseBuilding.priority ?? null,
      },
    ]);
  };

  const handlePlanChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPlanId = event.target.value;
    updatePlanLink({ sourceProductionId: nextPlanId || null });
  };

  const handleCapacityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value <= 0) return;
    updatePlanLink({ capacityPerMinute: value });
  };

  const handlePriorityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 0) return;
    updatePlanLink({ priority: value });
  };

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[11px] text-base-content/60 shrink-0">Source</span>
        <ClippedSelect
          value={selectedPlanId}
          onChange={handlePlanChange}
          displayValue={selectedPlanLabel}
          title={selectedPlanLabel}
        >
          <option className="text-base-content bg-base-100" value="">Manual</option>
          {plans.map((plan) => (
            <option className="text-base-content bg-base-100" key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </ClippedSelect>
      </div>

      {isPlanLinked && (
        <div className="grid grid-cols-2 gap-2">
          <label className="form-control">
            <span className="label-text text-[10px] mb-1">Capacity/min</span>
            <input
              type="number"
              min={1}
              className="input input-bordered input-xs"
              value={resolvedOutput.capacityPerMinuteResolved || ''}
              onChange={handleCapacityChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-[10px] mb-1">Priority</span>
            <input
              type="number"
              min={0}
              className="input input-bordered input-xs"
              value={baseBuilding.priority ?? 0}
              onChange={handlePriorityChange}
            />
          </label>
        </div>
      )}
    </div>
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
  const runtime = useRuntime();
  const [showSelectItemModal, setShowSelectItemModal] = useState(false);

  const { baseBuilding, building, count, isGrouped, sectionType, activePlanNames } = sectionBuilding;
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const base = useSubscription([appIds.subscriptions.BASES_BASE_BY_ID, baseId]);

  const isInputBuilding = !isGrouped && baseBuilding?.sectionType === 'inputs';
  const isOutputBuilding = !isGrouped && baseBuilding?.sectionType === 'outputs';
  const isLinkableInputBuilding = isInputBuilding && !isRawExtractor(building);
  const isLinkedInput = isInputBuilding && !!baseBuilding?.linkedOutput;
  const isLinkableOutputBuilding = isOutputBuilding &&
    !!baseBuilding &&
    !isLogisticsExcludedOutputBuildingId(baseBuilding.buildingTypeId);
  const resolvedOutput = isOutputBuilding && baseBuilding
    ? resolveOutputBuilding(baseBuilding, base || undefined)
    : null;
  const isPlanLinkedOutput = !!resolvedOutput?.sourceProductionId;

  const selectedItemId = isOutputBuilding ? resolvedOutput?.selectedItemId : baseBuilding?.selectedItemId;
  const selectedRatePerMinute = isOutputBuilding ? resolvedOutput?.ratePerMinute : baseBuilding?.ratePerMinute;
  const selectedItem = selectedItemId ? itemsMap[selectedItemId] : null;
  const displayName = baseBuilding?.name || building.name;
  const description = baseBuilding?.description;
  const totalPower = (building.power || 0) * count;
  const totalHeat = (building.heat || 0) * count;

  const isInActivePlan = activePlanNames.length > 0;
  const sectionLabel = sectionType[0].toUpperCase() + sectionType.slice(1);

  const setGroupedCount = useCallback((nextCount: number) => {
    runtime.dispatch([
      appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
      baseId,
      building.id,
      sectionType,
      sanitizeBuildingCount(nextCount),
    ]);
  }, [runtime, baseId, building.id, sectionType]);

  const handleRemoveClick = () => {
    if (isGrouped) {
      runtime.dispatch([
        appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
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
    runtime.dispatch([appIds.events.BASES_REMOVE_BUILDING, baseBuilding.id]);
  };

  const handleConfirmItemSelection = (itemId: string, ratePerMinute: number) => {
    if (!baseBuilding) return;
    runtime.dispatch([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, baseId, baseBuilding.id, itemId, ratePerMinute]);
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
                <LinkedInputItemButton baseBuilding={baseBuilding} />
              ) : (isInputBuilding || isOutputBuilding) && baseBuilding ? (
                <button
                  onClick={() => {
                    if (!isPlanLinkedOutput && !isLinkedInput) {
                      setShowSelectItemModal(true);
                    }
                  }}
                  className="flex-shrink-0 w-20 min-h-20 border-2 border-dashed border-base-300 hover:border-primary rounded-lg flex flex-col items-center justify-center gap-1 transition-colors bg-base-100 px-1"
                  title={selectedItem ? `${selectedItem.name} - ${selectedRatePerMinute}/min` : 'Select item'}
                >
                  {selectedItem ? (
                    <>
                      <ItemImage
                        itemId={selectedItem.id}
                        item={selectedItem}
                        size="small"
                        className="w-8 h-8"
                      />
                      <span className="text-xs text-center">{formatRate(selectedRatePerMinute)}/min</span>
                      {isPlanLinkedOutput && (
                        <span className="badge badge-xs px-1 min-h-0 h-4 badge-primary">
                          Plan
                        </span>
                      )}
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

            {isLinkableInputBuilding && baseBuilding && (
              <InputOutputLinkControls
                baseId={baseId}
                baseBuilding={baseBuilding}
              />
            )}

            {isOutputBuilding && baseBuilding && resolvedOutput && (
              <div className="rounded-md border border-base-300/70 bg-base-100/55 p-2.5 space-y-2">
                <OutputPlanLinkControls
                  baseId={baseId}
                  base={base}
                  baseBuilding={baseBuilding}
                  resolvedOutput={resolvedOutput}
                />
                {isLinkableOutputBuilding && (
                  <>
                    <div className="h-px bg-base-300/60" />
                    <OutputInputLinkControls
                      baseId={baseId}
                      baseBuilding={baseBuilding}
                    />
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-base-300/50 pt-2">

              <div className="text-xs flex flex-row gap-1 items-center" >
                <span>⚡</span>
                <span>{totalPower}</span>
                <span>🔥</span>
                <span>{totalHeat}</span>
              </div>

              <div className="flex items-center justify-end">
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

      {(isInputBuilding || isOutputBuilding) && !isLinkedInput && !isPlanLinkedOutput && baseBuilding && (
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
