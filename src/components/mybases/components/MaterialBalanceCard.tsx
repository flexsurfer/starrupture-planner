import React from 'react';
import type { PlanSummaryRow, MaterialBalanceRow } from '../types';
import { ItemImage } from '../../ui';
import { CoverageTableHeader } from './CoverageTableHeader';

function formatRate(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

interface MaterialBalanceCardProps {
  plans: PlanSummaryRow[];
  rows: MaterialBalanceRow[];
}

export const MaterialBalanceCard: React.FC<MaterialBalanceCardProps> = ({ plans, rows }) => {
  const totalRequired = rows.reduce((sum, row) => sum + row.totalRequired, 0);
  const totalAvailable = rows.reduce((sum, row) => sum + row.available, 0);
  const totalMissing = rows.reduce((sum, row) => sum + row.missing, 0);
  const totalSurplus = rows.reduce((sum, row) => sum + Math.max(0, row.available - row.totalRequired), 0);

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title text-xl">Materials Balance</h2>
          <p className="text-sm text-base-content/70">
            Required input materials by plan, total by base, and coverage from configured input buildings.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="badge badge-ghost badge-sm">{rows.length} material{rows.length !== 1 ? 's' : ''}</span>
          <span className="badge badge-neutral badge-sm">{formatRate(totalRequired)}/min required</span>
          <span className="badge badge-outline badge-sm">{formatRate(totalAvailable)}/min available</span>
          {totalMissing > 0 && (
            <span className="badge badge-error badge-sm">{formatRate(totalMissing)}/min missing</span>
          )}
          {totalSurplus > 0 && (
            <span className="badge badge-success badge-sm">+{formatRate(totalSurplus)}/min extra</span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/70">
            No external material requirements yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-xs">
              <CoverageTableHeader
                plans={plans}
                totalLabel="Total Needed"
                coverageLabel="Available"
                gapLabel="Balance"
              />
              <tbody>
                {rows.map((row) => {
                  const balance = row.available - row.totalRequired;
                  const balanceClass = balance > 0
                    ? 'text-success'
                    : balance < 0
                      ? 'text-error'
                      : 'text-base-content/50';
                  const balanceLabel = balance > 0
                    ? `+${formatRate(balance)}`
                    : balance < 0
                      ? formatRate(balance)
                      : '—';

                  return (
                    <tr key={row.itemId} className="border-t border-base-300/70">
                      <td className="sticky left-0 z-10 bg-base-100 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <ItemImage
                            itemId={row.item.id}
                            item={row.item}
                            size="small"
                            className="w-5 h-5"
                          />
                          <span className="truncate" title={row.item.name}>{row.item.name}</span>
                        </div>
                      </td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="px-2 py-2 text-center font-mono text-[11px]">
                          {row.perPlan[plan.id] ? formatRate(row.perPlan[plan.id]) : '—'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-mono text-[11px]">{formatRate(row.totalRequired)}</td>
                      <td
                        className="px-2 py-2 text-center font-mono text-[11px] text-base-content/80"
                        title={`Total available from configured input buildings: ${formatRate(row.available)}/min`}
                      >
                        {formatRate(row.available)}
                      </td>
                      <td className={`px-2 py-2 text-center font-mono text-[11px] ${balanceClass}`}>
                        {balanceLabel}/min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
