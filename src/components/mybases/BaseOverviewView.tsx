import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { PlanProductionCard } from './components/PlanProductionCard';
import { MaterialBalanceCard } from './components/MaterialBalanceCard';
import { BuildingCoverageCard } from './components/BuildingCoverageCard';

export const BaseOverviewView: React.FC = () => {
  const runtime = useRuntime();
  const selectedBaseId = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_ID]);
  const planRows = useSubscription([appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS]);
  const materialBalanceRows = useSubscription([appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS]);
  const buildingCoverageRows = useSubscription([appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS]);

  if (!selectedBaseId) {
    return null;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-ghost btn-sm text-base-content/65"
              onClick={() => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN])}
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
                <PlanProductionCard key={plan.id} plan={plan} baseId={selectedBaseId} />
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
