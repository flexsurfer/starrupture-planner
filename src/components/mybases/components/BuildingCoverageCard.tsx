import React, { useCallback } from 'react';
import { dispatch } from '@flexsurfer/reflex';
import type { PlanSummaryRow, BuildingCoverageRow } from '../types';
import { EVENT_IDS } from '../../../state/event-ids';
import { BuildingImage } from '../../ui';
import { CoverageTableHeader } from './CoverageTableHeader';
import { BuildingCountControl } from './BuildingCountControl';

interface BuildingCoverageControlProps {
  baseId: string;
  row: BuildingCoverageRow;
}

const BuildingCoverageControl: React.FC<BuildingCoverageControlProps> = ({ baseId, row }) => {
  const setOwnedCount = useCallback((nextCount: number) => {
    dispatch([
      EVENT_IDS.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
      baseId,
      row.buildingId,
      'production',
      nextCount,
    ]);
  }, [baseId, row.buildingId]);

  return (
    <BuildingCountControl
      value={row.owned}
      ariaLabel={`${row.building.name} owned count`}
      onChange={setOwnedCount}
    />
  );
};

interface BuildingCoverageCardProps {
  baseId: string;
  plans: PlanSummaryRow[];
  rows: BuildingCoverageRow[];
}

export const BuildingCoverageCard: React.FC<BuildingCoverageCardProps> = ({ baseId, plans, rows }) => {
  const totalRequired = rows.reduce((sum, row) => sum + row.totalRequired, 0);
  const totalCovered = rows.reduce((sum, row) => sum + row.covered, 0);
  const totalMissing = rows.reduce((sum, row) => sum + row.missing, 0);
  const totalSurplus = rows.reduce((sum, row) => sum + Math.max(0, row.owned - row.totalRequired), 0);

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title text-xl">Buildings Coverage</h2>
          <p className="text-sm text-base-content/70">
            Building demand per plan, total by base, and owned count editing in place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="badge badge-ghost badge-sm">{rows.length} building type{rows.length !== 1 ? 's' : ''}</span>
          <span className="badge badge-neutral badge-sm">{totalRequired} required</span>
          <span className="badge badge-outline badge-sm">{totalCovered} covered</span>
          {totalMissing > 0 && (
            <span className="badge badge-error badge-sm">{totalMissing} missing</span>
          )}
          {totalSurplus > 0 && (
            <span className="badge badge-success badge-sm">+{totalSurplus} extra</span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/70">
            No building requirements yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-xs">
              <CoverageTableHeader
                plans={plans}
                totalLabel="Total"
                coverageLabel="Coverage"
                gapLabel="Balance"
              />
              <tbody>
                {rows.map((row) => {
                  const balance = row.owned - row.totalRequired;
                  const balanceClass = balance > 0
                    ? 'text-success'
                    : balance < 0
                      ? 'text-error'
                      : 'text-base-content/50';
                  const balanceLabel = balance > 0
                    ? `+${balance}`
                    : balance < 0
                      ? String(balance)
                      : '—';

                  return (
                    <tr key={row.buildingId} className="border-t border-base-300/70">
                      <td className="sticky left-0 z-10 bg-base-100 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <BuildingImage
                            buildingId={row.building.id}
                            building={row.building}
                            size="small"
                            className="w-5 h-5"
                          />
                          <span className="truncate" title={row.building.name}>{row.building.name}</span>
                        </div>
                      </td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="px-2 py-2 text-center font-mono text-[11px]">
                          {row.perPlan[plan.id] ? row.perPlan[plan.id] : '—'}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-mono text-[11px]">{row.totalRequired}</td>
                      <td className="px-2 py-2 text-center">
                        <BuildingCoverageControl baseId={baseId} row={row} />
                      </td>
                      <td className={`px-2 py-2 text-center font-mono text-[11px] ${balanceClass}`}>
                        {balanceLabel}
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
