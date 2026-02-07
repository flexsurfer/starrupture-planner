import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import type { Base } from '../../state/db';
import { BaseCoreInfo, BaseBuildingsView, BasePlansView } from './index';

export const BaseDetailView: React.FC = () => {
  const selectedBase = useSubscription<Base | null>([SUB_IDS.BASES_SELECTED_BASE]);

  // Early return if no base selected
  if (!selectedBase) {
    return null;
  }

  const plansCount = selectedBase.productions?.length || 0;
  const buildingsCount = selectedBase.buildings?.length || 0;

  return (
    <div className="h-full p-2 lg:p-3 flex flex-col">
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
