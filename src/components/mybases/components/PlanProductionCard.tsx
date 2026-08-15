import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { PlanSummaryRow, ProductionPlanRequirementsStatus } from '@/features/bases/types';
import { BuildingImage, ItemImage } from '../../ui';
import { getPlanOutputAllocationSummary } from '../../../utils/planOutputAllocations';

function formatPlanStatus(status: ProductionPlanRequirementsStatus['planStatus']): string {
  return status === 'inactive' ? 'Inactive' : 'Active';
}

function formatRate(value: number | undefined): string {
  if (!value || value <= 0) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

interface PlanProductionCardProps {
  plan: PlanSummaryRow;
  baseId: string;
}

export const PlanProductionCard: React.FC<PlanProductionCardProps> = ({ plan, baseId }) => {
  const runtime = useRuntime();
  const requirementsStatus = useSubscription([
    appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID,
    baseId,
    plan.id,
  ]);
  const base = useSubscription([appIds.subscriptions.BASES_BASE_BY_ID, baseId]);
  const outputItems = useSubscription([appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, baseId]) || [];
  const logistics = useSubscription([appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, baseId]);

  const effectiveStatus = requirementsStatus?.planStatus || plan.status;
  const hasError = requirementsStatus?.hasError ?? effectiveStatus === 'error';
  const hasWarning = !hasError && effectiveStatus === 'active' && (
    requirementsStatus?.allRequirementsSatisfied === false ||
    requirementsStatus?.hasMaterialShortage === true
  );
  const badgeClass = hasError
    ? 'badge-error'
    : effectiveStatus === 'inactive'
      ? 'badge-ghost'
      : hasWarning
        ? 'badge-warning'
        : 'badge-success';
  const outputSummary = base ? getPlanOutputAllocationSummary(base, plan.id) : null;
  const linkedOutputs = outputSummary?.outputs || [];

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {plan.targetItem ? (
          <ItemImage
            itemId={plan.targetItem.id}
            item={plan.targetItem}
            size="small"
            className="w-12 h-12 rounded-xl"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-base-300 text-base-content/40">
            ?
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{plan.itemName}</div>
          <div className="text-sm text-base-content/70">
            {plan.targetAmount}/min
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`badge badge-sm ${badgeClass}`}>
          {formatPlanStatus(effectiveStatus)}
        </span>
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={() => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, plan.id])}
        >
          Edit
        </button>
      </div>
    </div>

    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs">
      <div className="min-w-[130px] rounded-lg border border-base-300 bg-base-100/80 px-2 py-1.5">
        <div className="text-base-content/55">Plan</div>
        <div className="truncate font-medium" title={plan.name}>{plan.name}</div>
      </div>
      <div className="min-w-[90px] rounded-lg border border-base-300 bg-base-100/80 px-2 py-1.5">
        <div className="text-base-content/55">Buildings</div>
        <div className="font-medium">{plan.requiredBuildingCount}</div>
      </div>
      <div className="min-w-[90px] rounded-lg border border-base-300 bg-base-100/80 px-2 py-1.5">
        <div className="text-base-content/55">Inputs</div>
        <div className="font-medium">{plan.inputCount}</div>
      </div>
      <div className="min-w-[150px] rounded-lg border border-base-300 bg-base-100/80 px-2 py-1.5">
        <div className="text-base-content/55">Corporation</div>
        <div className="font-medium truncate" title={plan.corporationLabel}>{plan.corporationLabel}</div>
      </div>
    </div>

    {outputSummary && linkedOutputs.length > 0 && (
      <div className="mt-3 rounded-lg border border-base-300/45 bg-base-100/45 px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <div className="font-semibold text-base-content/70">Outputs</div>
          <div className="font-mono text-base-content/60" title={`${formatRate(outputSummary.producedRatePerMinute)}/min produced`}>
            {formatRate(outputSummary.assignedRatePerMinute)}/min assigned
            {outputSummary.remainingRatePerMinute > 0 && (
              <span className="text-warning"> · {formatRate(outputSummary.remainingRatePerMinute)}/min left</span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          {linkedOutputs.slice(0, 3).map((output) => {
            const outputItem = outputItems.find((entry) => entry.baseBuildingId === output.id);
            const logisticsOutput = logistics?.outputs.find((entry) => entry.baseBuildingId === output.id);
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
                className="flex items-center gap-2 rounded-md border border-base-300/40 bg-base-100/45 px-2 py-1.5"
              >
                <BuildingImage
                  buildingId={output.buildingTypeId}
                  building={outputItem?.building}
                  size="small"
                  className="h-5 w-5 shrink-0 rounded opacity-85"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-base-content/75" title={outputName}>
                    {outputName}
                  </div>
                  {(hasWarning || targetLabel) && (
                    <div
                      className={`truncate text-[11px] ${targetLabel && !hasWarning ? 'text-info' : 'text-base-content/45'}`}
                      title={linkedInputs.map((entry) => entry.baseName).join(', ')}
                    >
                      {hasWarning ? 'limited by source/capacity' : `to ${targetLabel}`}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-xs text-base-content/75">
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
          {linkedOutputs.length > 3 && (
            <div className="text-[11px] text-base-content/45">+{linkedOutputs.length - 3} more outputs</div>
          )}
        </div>
      </div>
    )}
  </div>
  );
};
