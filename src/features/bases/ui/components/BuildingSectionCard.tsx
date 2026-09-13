import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useMemo, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Base, BaseBuilding, Building, Item } from '@/app/uklad/model';
import type { BuildingSectionBuilding, LinkableOutputItem } from '@/features/bases/types';
import { isLogisticsExcludedOutputBuildingId, isRawExtractor } from '@/features/bases/building-section';
import { sanitizeBuildingCount } from '@/features/bases/building-counts';
import { BuildingImage, ClippedSelect, ItemImage } from '@/shared/ui';
import { SelectItemModal } from '../modals';
import { BuildingCountControl } from './BuildingCountControl';
import { resolveInputBuilding, resolveLinkedOutput } from '@/utils/productionPlanInputs';
import type { ResolvedInputBuilding } from '@/utils/productionPlanInputs';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import type { ResolvedOutputBuilding } from '@/utils/planOutputAllocations';
import { getItemCategoryColor } from '@/utils/itemColors';

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

interface BuildingItemSummaryProps {
  item?: Item | null;
  rate?: number;
  status?: string;
  hasError?: boolean;
}

const BuildingItemSummary = ({ item, rate, status, hasError }: BuildingItemSummaryProps) => (
  <span className="flex min-w-0 flex-1 items-center gap-2">
    {item && <span className="shrink-0 [&>div]:size-8 [&_img]:size-8"><ItemImage itemId={item.id} item={item} size="small" /></span>}
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-normal leading-snug text-base-content/75 break-words">{item?.name || 'No item selected'}</span>
      {item && <span className="block text-xs font-medium tabular-nums" style={{ color: getItemCategoryColor(item.type) }}>{formatRate(rate)}/min</span>}
    </span>
    {status && <span className={`shrink-0 text-[11px] ${hasError ? 'text-error' : 'text-base-content/60'}`}>{status}</span>}
  </span>
);

const LinkedInputItemSummary = ({ baseBuilding }: { baseBuilding: BaseBuilding }) => {
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const { resolved, hasError, label } = useLinkedInputData(baseBuilding);
  const selectedItem = resolved.selectedItemId ? itemsMap[resolved.selectedItemId] : null;

  return (
    <div className={`rounded-md border bg-base-content/5 p-2 ${hasError ? 'border-error/50' : 'border-transparent'}`}
      title={`${hasError ? 'Broken linked output' : 'Linked output'}: ${label}`}>
      <BuildingItemSummary item={selectedItem} rate={resolved.ratePerMinute} status={hasError ? 'Broken link' : 'Linked'} hasError={hasError} />
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
    <div className="min-w-0">
      <label className="flex min-w-0 items-center gap-2">
        <span className="w-10 shrink-0 text-xs text-base-content/60">Source</span>
        <ClippedSelect
          size="sm"
          tone="muted"
          ariaLabel="Source"
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
      </label>
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
      <label className="flex min-w-0 items-center gap-2">
        <span className="w-10 shrink-0 text-xs text-base-content/60">Target</span>
        <ClippedSelect
          size="sm"
          tone="muted"
          ariaLabel="Target"
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
      </label>
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
      <label className="flex min-w-0 items-center gap-2">
        <span className="w-10 shrink-0 text-xs text-base-content/60">Source</span>
        <ClippedSelect
          size="sm"
          tone="muted"
          ariaLabel="Source"
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
      </label>

      {isPlanLinked && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-base-content/60">Capacity/min</span>
            <input
              type="number"
              min={1}
              className="input input-bordered input-sm h-8 w-full min-w-0 bg-transparent text-xs tabular-nums"
              value={resolvedOutput.capacityPerMinuteResolved || ''}
              onChange={handleCapacityChange}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-base-content/60">Priority</span>
            <input
              type="number"
              min={0}
              className="input input-bordered input-sm h-8 w-full min-w-0 bg-transparent text-xs tabular-nums"
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
      <article className={`min-w-0 rounded-lg border bg-base-200 p-2 sm:p-3 ${isInActivePlan ? 'border-primary/60' : 'border-base-300'}`}>
        <div className="flex items-start gap-2">
          <BuildingImage buildingId={building.id} building={building} size="small" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-snug text-base-content/80 break-words">{displayName}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-base-content/60 tabular-nums">
              <span title={building.type === 'generator' ? 'Power generation' : 'Power consumption'}>⚡ {building.type === 'generator' ? '+' : ''}{totalPower} MW</span>
              <span title="Heat">🔥 {totalHeat}</span>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-ghost h-8 min-h-8 w-8 shrink-0 p-0 text-base-content/50 hover:text-error"
            aria-label={`Remove ${displayName}`} title={`Remove ${displayName}`} onClick={handleRemoveClick}>
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {description && <p className="mt-2 text-xs leading-relaxed text-base-content/60 break-words">{description}</p>}
        {isInActivePlan && <p className="mt-2 text-xs leading-snug text-base-content/60 break-words">
          <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
          Active in {activePlanNames.join(', ')}
        </p>}

        {isGrouped && <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-base-300 pt-2">
          <span className="text-xs text-base-content/60">Count</span>
          <BuildingCountControl compact value={count} ariaLabel={`${building.name} ${sectionType} count`} onChange={setGroupedCount} />
        </div>}

        {(isInputBuilding || isOutputBuilding) && baseBuilding && <div className="mt-2 space-y-2">
          {isLinkedInput ? (
            <LinkedInputItemSummary baseBuilding={baseBuilding} />
          ) : isPlanLinkedOutput ? (
            <div className="rounded-md border border-transparent bg-base-content/5 p-2">
              <BuildingItemSummary item={selectedItem} rate={selectedRatePerMinute} status="Plan" />
            </div>
          ) : (
            <button type="button" onClick={() => setShowSelectItemModal(true)}
              className="flex w-full min-w-0 items-center gap-2 rounded-md border border-base-300 bg-base-content/5 p-2 text-left transition-colors hover:border-base-content/40 focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={selectedItem ? `Edit ${selectedItem.name} item and rate` : `Select item for ${displayName}`}>
              {selectedItem ? <BuildingItemSummary item={selectedItem} rate={selectedRatePerMinute} /> : <span className="flex-1 text-sm text-base-content/65">Select item & rate</span>}
              <svg aria-hidden="true" className="size-3.5 shrink-0 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 0 1 2.652 2.652L9.832 16.82a4.5 4.5 0 0 1-1.897 1.13L5.25 18.75l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0 2.651 2.652" />
              </svg>
            </button>
          )}

          {isLinkableInputBuilding && <InputOutputLinkControls baseId={baseId} baseBuilding={baseBuilding} />}
          {isOutputBuilding && resolvedOutput && <div className="space-y-2">
            <OutputPlanLinkControls baseId={baseId} base={base} baseBuilding={baseBuilding} resolvedOutput={resolvedOutput} />
            {isLinkableOutputBuilding && <OutputInputLinkControls baseId={baseId} baseBuilding={baseBuilding} />}
          </div>}
        </div>}
      </article>

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
