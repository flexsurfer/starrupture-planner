import React from 'react';
import type { PlanSummaryRow } from '../types';
import { ItemImage } from '../../ui';

interface CoverageTableHeaderProps {
  plans: PlanSummaryRow[];
  totalLabel: string;
  coverageLabel: string;
  gapLabel: string;
}

export const CoverageTableHeader: React.FC<CoverageTableHeaderProps> = ({
  plans,
  totalLabel,
  coverageLabel,
  gapLabel,
}) => (
  <thead>
    <tr className="text-xs text-base-content/60">
      <th className="sticky left-0 z-10 bg-base-100 px-3 py-2 text-left">Type</th>
      {plans.map((plan) => (
        <th key={plan.id} className="min-w-[96px] px-2 py-2 text-center font-medium">
          <div className="flex flex-col items-center gap-1">
            {plan.targetItem ? (
              <ItemImage
                itemId={plan.targetItem.id}
                item={plan.targetItem}
                size="small"
                className="w-5 h-5"
              />
            ) : (
              <span className="text-[10px] text-base-content/40">?</span>
            )}
            <span className="max-w-[88px] truncate" title={plan.name}>{plan.name}</span>
          </div>
        </th>
      ))}
      <th className="px-2 py-2 text-center">{totalLabel}</th>
      <th className="px-2 py-2 text-center">{coverageLabel}</th>
      <th className="px-2 py-2 text-center">{gapLabel}</th>
    </tr>
  </thead>
);
