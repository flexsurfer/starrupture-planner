import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Base, BaseBuilding, Item } from '@/app/uklad/model';
import type { BuildingSectionBuilding, LinkableInputItem, LinkableOutputItem } from '@/features/bases/types';
import { isLogisticsExcludedOutputBuildingId } from '@/features/bases/building-section';
import { sanitizeBuildingCount } from '@/features/bases/building-counts';
import { BuildingImage, ClippedSelect, ItemImage } from '@/shared/ui';
import { EditBuildingModal, SelectItemModal } from '../modals';
import { BuildingCountControl } from './BuildingCountControl';
import { resolveInputBuilding, resolveLinkedOutput } from '@/utils/productionPlanInputs';
import type { ResolvedInputBuilding } from '@/utils/productionPlanInputs';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import type { ResolvedOutputBuilding } from '@/utils/planOutputAllocations';
import { getItemCategoryColor } from '@/utils/itemColors';
import { areConnectionTypesCompatible, getConnectionPairs, supportsOutputLink } from '@/features/bases/connections';
import { canDuplicateLogisticsBuilding } from '@/features/bases/building-operations';
import { connectionLabel, connectionLocationLabel } from '../utils/connectionLabels';
import { ConnectionPickerButton } from './ConnectionPickerButton';
import { ConnectionPickerModal } from '../modals/ConnectionPickerModal';
import { useDisconnectConnections } from '../useDisconnectConnections';

interface LinkedInputData {
  resolved: ResolvedInputBuilding;
  hasError: boolean;
  incompatible: boolean;
  label: string;
}

/**
 * Subscribes to BASES_LIST only when rendered by input-link controls.
 * Keeps the parent BuildingSectionCard free from that subscription.
 */
const useLinkedInputData = (baseBuilding: BaseBuilding): LinkedInputData => {
    const { t } = useTranslation();
  const allBases = useSubscription([appIds.subscriptions.BASES_LIST]) || [];
  const buildingsById = useSubscription([appIds.subscriptions.BUILDINGS_BY_ID_MAP]);

  const resolved = resolveInputBuilding(baseBuilding, allBases);
  const resolution = resolveLinkedOutput(baseBuilding, allBases);
  const sourceOutputBuilding = resolution.sourceOutput
    ? buildingsById[resolution.sourceOutput.buildingTypeId]
    : null;

  const baseName = resolution.sourceBase?.name || t("Missing base");
  const outputName =
    resolution.sourceOutput?.name ||
    sourceOutputBuilding?.name ||
    baseBuilding.linkedOutput?.buildingId ||
    '';
  const label = `${baseName}${outputName ? ` / ${outputName}` : ''}`;
  const hasError = !!resolved.linkedOutput && resolved.linkedOutputStatus !== 'ok';

  const incompatible = !!sourceOutputBuilding && !areConnectionTypesCompatible(sourceOutputBuilding, buildingsById[baseBuilding.buildingTypeId]);
  return { resolved, hasError, incompatible, label };
};

interface BuildingItemSummaryProps {
  item?: Item | null;
  rate?: number;
  status?: string;
  hasError?: boolean;
}

const BuildingItemSummary = ({ item, rate, status, hasError }: BuildingItemSummaryProps) => { const { t } = useTranslation(); return (
  <span className="flex min-w-0 flex-1 items-center gap-2">
    {item && <span className="shrink-0 [&>div]:size-8 [&_img]:size-8"><ItemImage itemId={item.id} item={item} size="small" /></span>}
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-normal leading-snug text-base-content/75 break-words">{item?.name || t("No item selected")}</span>
      {item && <span className="block text-xs font-medium tabular-nums" style={{ color: getItemCategoryColor(item.type) }}>{t("{value}/min", { value: formatRate(rate) })}</span>}
    </span>
    {status && <span className={`shrink-0 text-[11px] ${hasError ? 'text-error' : 'text-base-content/60'}`}>{status}</span>}
  </span>
); };

const LinkedInputItemSummary = ({ baseBuilding }: { baseBuilding: BaseBuilding }) => {
    const { t } = useTranslation();
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const { resolved, hasError, label } = useLinkedInputData(baseBuilding);
  const selectedItem = resolved.selectedItemId ? itemsMap[resolved.selectedItemId] : null;

  return (
    <div className={`rounded-md border bg-base-content/5 p-2 ${hasError ? 'border-error/50' : 'border-transparent'}`}
      title={`${hasError ? t("Broken linked output") : t("Linked output")}: ${label}`}>
      <BuildingItemSummary item={selectedItem} rate={resolved.ratePerMinute} status={hasError ? t("Broken link") : t("Linked")} hasError={hasError} />
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

interface InputOutputLinkControlsProps {
  baseId: string;
  baseBuilding: BaseBuilding;
}

const InputOutputLinkControls: React.FC<InputOutputLinkControlsProps> = ({ baseId, baseBuilding }) => {
  const { t } = useTranslation();
  const runtime = useRuntime();
  const [showPicker, setShowPicker] = useState(false);
  const confirmDisconnect = useDisconnectConnections();
  const outputs = useSubscription([appIds.subscriptions.BASES_CONNECTION_OUTPUTS, baseId, baseBuilding.buildingTypeId]);
  const { incompatible, label } = useLinkedInputData(baseBuilding);
  const linkedOutput = baseBuilding.linkedOutput;
  const selectedOutputKey = linkedOutput ? getLinkableOutputKey(linkedOutput.baseId, linkedOutput.buildingId) : '';
  const selectedOutput = outputs.find(output => getLinkableOutputKey(output.baseId, output.baseBuildingId) === selectedOutputKey);
  const selectedOutputLabel = selectedOutput ? connectionLocationLabel(selectedOutput, t) : linkedOutput ? label : t("Manual");

  const disconnect = () => {
    if (linkedOutput) confirmDisconnect([{ source: linkedOutput, target: { baseId, buildingId: baseBuilding.id } }]);
  };
  const handleSourceChange = (output: LinkableOutputItem) => {
    if (linkedOutput || output.connections.length) return;
    runtime.dispatch([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, baseId, baseBuilding.id, output.baseId, output.baseBuildingId]);
    setShowPicker(false);
  };

  return <div className="min-w-0 space-y-2">
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-base-content/60">{t("Source")}</span>
      <ConnectionPickerButton label={t('Source')} value={selectedOutputLabel}
        title={selectedOutput ? connectionLabel(selectedOutput, t) : selectedOutputLabel}
        expanded={showPicker} onClick={() => setShowPicker(true)} />
    </div>
    {incompatible && <p className="text-xs text-warning">{t('This saved connection is incompatible. Disconnect it before choosing another.')}</p>}
    {!linkedOutput && outputs.length === 0 && <p className="text-xs text-base-content/60">{t('No compatible outputs found.')}</p>}
    <ConnectionPickerModal isOpen={showPicker} direction="output" entries={outputs} currentBaseId={baseId}
      currentBuildingId={baseBuilding.id}
      currentConnections={linkedOutput ? [selectedOutputLabel] : []} onDisconnect={disconnect}
      onSelect={handleSourceChange} onClose={() => setShowPicker(false)} />
  </div>;
};

interface OutputInputLinkControlsProps {
  baseId: string;
  baseBuilding: BaseBuilding;
}

const OutputInputLinkControls: React.FC<OutputInputLinkControlsProps> = ({ baseId, baseBuilding }) => {
  const { t } = useTranslation();
  const runtime = useRuntime();
  const [showPicker, setShowPicker] = useState(false);
  const confirmDisconnect = useDisconnectConnections();
  const inputs = useSubscription([appIds.subscriptions.BASES_CONNECTION_INPUTS, baseId, baseBuilding.id, baseBuilding.buildingTypeId]);
  const linkedInputs = inputs.filter(input => input.connections.some(connection => connection.baseId === baseId && connection.buildingId === baseBuilding.id));
  const linkedInput = linkedInputs[0];
  const selectedInputLabel = linkedInput ? connectionLocationLabel(linkedInput, t) : t("No target");

  const handleTargetChange = (input: LinkableInputItem) => {
    if (linkedInputs.length || input.connections.length) return;
    runtime.dispatch([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, input.baseId, input.buildingId, baseId, baseBuilding.id]);
    setShowPicker(false);
  };
  const disconnect = () => confirmDisconnect(linkedInputs.flatMap(getConnectionPairs));

  return <div className="space-y-2">
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-base-content/60">{t("Target")}</span>
      <ConnectionPickerButton label={t('Target')} value={selectedInputLabel}
        title={linkedInput ? connectionLabel(linkedInput, t) : selectedInputLabel}
        expanded={showPicker} onClick={() => setShowPicker(true)} />
    </div>
    {linkedInputs.length > 1 && <p className="text-xs text-base-content/60">{linkedInputs.map(input => connectionLocationLabel(input, t)).join('; ')}</p>}
    <ConnectionPickerModal isOpen={showPicker} direction="input" entries={inputs} currentBaseId={baseId}
      currentBuildingId={baseBuilding.id}
      currentConnections={linkedInputs.map(input => connectionLocationLabel(input, t))}
      onDisconnect={disconnect} onSelect={handleTargetChange} onClose={() => setShowPicker(false)} />
  </div>;
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
    const { t } = useTranslation();
  const runtime = useRuntime();
  const plans = base?.productions || [];
  const isPlanLinked = !!baseBuilding.sourceProductionId;
  const selectedPlanId = baseBuilding.sourceProductionId || '';
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const selectedPlanLabel = selectedPlan?.name || t("Manual");

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
        <span className="w-10 shrink-0 text-xs text-base-content/60">{t("Plan")}</span>
        <ClippedSelect
          size="sm"
          tone="muted"
          ariaLabel={t("Plan")}
          value={selectedPlanId}
          onChange={handlePlanChange}
          displayValue={selectedPlanLabel}
          title={selectedPlanLabel}
        >
          <option className="text-base-content bg-base-100" value="">{t("Manual")}</option>
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
            <span className="text-xs text-base-content/60">{t("Capacity/min")}</span>
            <input
              type="number"
              min={1}
              className="input input-bordered input-sm h-8 w-full min-w-0 bg-transparent text-xs tabular-nums"
              value={resolvedOutput.capacityPerMinuteResolved || ''}
              onChange={handleCapacityChange}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-base-content/60">{t("Priority")}</span>
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
    const { t } = useTranslation();
  const runtime = useRuntime();
  const [showSelectItemModal, setShowSelectItemModal] = useState(false);
  const [showEditBuildingModal, setShowEditBuildingModal] = useState(false);

  const { baseBuilding, building, count, isGrouped, sectionType, activePlanNames } = sectionBuilding;
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const base = useSubscription([appIds.subscriptions.BASES_BASE_BY_ID, baseId]);

  const isInputBuilding = !isGrouped && baseBuilding?.sectionType === 'inputs';
  const isOutputBuilding = !isGrouped && baseBuilding?.sectionType === 'outputs';
  const isLinkableInputBuilding = isInputBuilding && (supportsOutputLink(building) || !!baseBuilding?.linkedOutput);
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
  const sectionLabel = { inputs: t("Inputs"), outputs: t("Outputs"), production: t("Production"), energy: t("Energy"), infrastructure: t("Infrastructure") }[sectionType];
  const countLabel = {
    inputs: t("{name} inputs count", { name: building.name }),
    outputs: t("{name} outputs count", { name: building.name }),
    production: t("{name} production count", { name: building.name }),
    energy: t("{name} energy count", { name: building.name }),
    infrastructure: t("{name} infrastructure count", { name: building.name }),
  }[sectionType];

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
        t("Remove {name}?", { name: building.name }),
        t("Remove all {count} {name} buildings from {sectionLabel}?", { count, name: building.name, sectionLabel }),
        () => setGroupedCount(0),
        {
          confirmLabel: t("Remove"),
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
            <div className="flex items-start gap-1">
              <h3 className="min-w-0 text-sm font-medium leading-snug text-base-content/80 break-words">{displayName}</h3>
              {!isGrouped && baseBuilding && <button
                type="button"
                className="btn btn-xs btn-ghost shrink-0 px-1 text-base-content/55 hover:text-base-content"
                aria-label={t("Edit {name}", { name: displayName })}
                title={t("Edit {name}", { name: displayName })}
                onClick={() => setShowEditBuildingModal(true)}
              >
                <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 0 1 2.652 2.652L9.832 16.82a4.5 4.5 0 0 1-1.897 1.13L5.25 18.75l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0 2.651 2.652" />
                </svg>
              </button>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-base-content/60 tabular-nums">
              <span title={building.type === 'generator' ? t("Power generation") : t("Power consumption")}>⚡ {building.type === 'generator' ? '+' : ''}{totalPower} MW</span>
              <span title={t("Heat")}>🔥 {totalHeat}</span>
            </div>
          </div>
          {!isGrouped && baseBuilding && canDuplicateLogisticsBuilding(baseBuilding) && <button
            type="button"
            className="btn btn-sm btn-ghost h-8 min-h-8 w-8 shrink-0 p-0 text-base-content/50 hover:text-base-content"
            aria-label={t('Duplicate {name}', { name: displayName })}
            title={t('Duplicate without connections')}
            onClick={() => runtime.dispatch([appIds.events.BASES_DUPLICATE_BUILDING, baseId, baseBuilding.id, `building_${crypto.randomUUID()}`])}
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" />
            </svg>
          </button>}
          <button type="button" className="btn btn-sm btn-ghost h-8 min-h-8 w-8 shrink-0 p-0 text-base-content/50 hover:text-error"
            aria-label={t("Remove {displayName}", { displayName: displayName })} title={t("Remove {displayName}", { displayName: displayName })} onClick={handleRemoveClick}>
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {description && <p className="mt-2 text-xs leading-relaxed text-base-content/60 whitespace-pre-wrap break-words">{description}</p>}
        {baseBuilding?.planningOwnerPlanId && <p className="mt-2 text-xs text-base-content/55" title={t("Created for this plan in Planning mode. Editing this endpoint's configuration makes it manually managed.")}>{t("Managed by plan: ")}{base?.productions.find(plan => plan.id === baseBuilding.planningOwnerPlanId)?.name || t("Unknown plan")}
        </p>}
        {isInActivePlan && <p className="mt-2 text-xs leading-snug text-base-content/60 break-words">
          <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />{t("Active in {activePlanNames}", { activePlanNames: activePlanNames.join(', ') })}</p>}

        {isGrouped && <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-base-300 pt-2">
          <span className="text-xs text-base-content/60">{t("Count")}</span>
          <BuildingCountControl compact value={count} ariaLabel={countLabel} onChange={setGroupedCount} />
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
              aria-label={selectedItem ? t("Edit {name} item and rate", { name: selectedItem.name }) : t("Select item for {displayName}", { displayName: displayName })}>
              {selectedItem ? <BuildingItemSummary item={selectedItem} rate={selectedRatePerMinute} /> : <span className="flex-1 text-sm text-base-content/65">{t("Select item & rate")}</span>}
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

      {showEditBuildingModal && !isGrouped && baseBuilding && (
        <EditBuildingModal
          defaultName={building.name}
          currentName={baseBuilding.name}
          currentDescription={baseBuilding.description}
          onClose={() => setShowEditBuildingModal(false)}
          onSave={(name, nextDescription) => {
            runtime.dispatch([appIds.events.BASES_UPDATE_BUILDING_DETAILS, baseId, baseBuilding.id, name, nextDescription]);
            setShowEditBuildingModal(false);
          }}
        />
      )}

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
