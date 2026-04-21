import React from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import type { PlanSummaryRow, ProductionPlanRequirementsStatus } from '../types';
import { EVENT_IDS } from '../../../state/event-ids';
import { SUB_IDS } from '../../../state/sub-ids';
import { ItemImage } from '../../ui';

function formatPlanStatus(status: ProductionPlanRequirementsStatus['planStatus']): string {
  return status === 'inactive' ? 'Inactive' : 'Active';
}

interface PlanProductionCardProps {
  plan: PlanSummaryRow;
  baseId: string;
}

export const PlanProductionCard: React.FC<PlanProductionCardProps> = ({ plan, baseId }) => {
  const requirementsStatus = useSubscription<ProductionPlanRequirementsStatus>([
    SUB_IDS.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID,
    baseId,
    plan.id,
  ]);

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
          onClick={() => dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_OPEN, plan.id])}
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
  </div>
  );
};
