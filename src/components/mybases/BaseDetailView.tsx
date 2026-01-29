import React, { useCallback } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';
import { SUB_IDS } from '../../state/sub-ids';
import type { Base } from '../../state/db';
import { BaseCoreInfo, BaseBuildingsView, BasePlansView } from './index';

export const BaseDetailView: React.FC = () => {
  const selectedBase = useSubscription<Base | null>([SUB_IDS.SELECTED_BASE]);

  const onBack = useCallback(() => {
    dispatch([EVENT_IDS.SET_SELECTED_BASE, null]);
  }, []);

  // Early return if no base selected
  if (!selectedBase) {
    return null;
  }

  const plansCount = selectedBase.productionPlanSections?.length || 0;
  const buildingsCount = selectedBase.buildings?.length || 0;

  return (
    <div className="h-full p-2 lg:p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button
          className="btn btn-sm btn-ghost"
          onClick={onBack}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold">{selectedBase.name}</h1>
      </div>

      {/* Core Info and Stats - Fixed, not scrollable */}
      <div className="mb-4 flex-shrink-0">
        <BaseCoreInfo />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto space-y-6">
        {/* Plans Section */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Plans
            {plansCount > 0 && (
              <span className="badge badge-sm badge-primary">{plansCount}</span>
            )}
          </h2>
          <BasePlansView />
        </div>

        {/* Buildings Section */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Buildings
            {buildingsCount > 0 && (
              <span className="badge badge-sm badge-secondary">{buildingsCount}</span>
            )}
          </h2>
          <BaseBuildingsView />
        </div>
      </div>
    </div>
  );
};
