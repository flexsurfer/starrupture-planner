import React from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import type { PlanSummaryRow, MaterialBalanceRow, BuildingCoverageRow } from './types';
import { EVENT_IDS } from '../../state/event-ids';
import { SUB_IDS } from '../../state/sub-ids';
import { PlanProductionCard } from './components/PlanProductionCard';
import { MaterialBalanceCard } from './components/MaterialBalanceCard';
import { BuildingCoverageCard } from './components/BuildingCoverageCard';

export const BaseOverviewView: React.FC = () => {
  const selectedBaseId = useSubscription<string | null>([SUB_IDS.BASES_SELECTED_BASE_ID]);
  const planRows = useSubscription<PlanSummaryRow[]>([SUB_IDS.BASES_OVERVIEW_PLAN_ROWS]);
  const materialBalanceRows = useSubscription<MaterialBalanceRow[]>([SUB_IDS.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS]);
  const buildingCoverageRows = useSubscription<BuildingCoverageRow[]>([SUB_IDS.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS]);

  if (!selectedBaseId) {
    return null;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="card-title text-xl">Production</h2>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm self-start sm:self-center"
              onClick={() => dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_OPEN])}
            >
              Add Plan
            </button>
          </div>

          {planRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/70">
              No production plans yet.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {planRows.map((plan) => (
                <PlanProductionCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      </div>

      <MaterialBalanceCard plans={planRows} rows={materialBalanceRows} />

      <BuildingCoverageCard baseId={selectedBaseId} plans={planRows} rows={buildingCoverageRows} />
    </div>
  );
};
