import React, { useState } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import type { Base } from '../../state/db';
import { BaseCoreInfo, BaseBuildingsView, BasePlansView, CreateProductionPlanModal } from './index';

type BaseDetailTab = 'plans' | 'buildings';

export const BaseDetailView: React.FC = () => {
  const selectedBase = useSubscription<Base | null>([SUB_IDS.BASES_SELECTED_BASE]);
  const [activeTab, setActiveTab] = useState<BaseDetailTab>('plans');

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

      <div className="flex-1 flex flex-col min-h-0">
        <div
          role="tablist"
          className="tabs tabs-bordered tabs-lg flex-shrink-0 mb-4"
          aria-label="Base sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'plans'}
            id="base-tab-plans"
            aria-controls="base-panel-plans"
            className={`tab text-xl font-bold flex items-center gap-2 ${activeTab === 'plans' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            Plans
            {plansCount > 0 && (
              <span className="badge badge-sm badge-primary">{plansCount}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'buildings'}
            id="base-tab-buildings"
            aria-controls="base-panel-buildings"
            className={`tab text-xl font-bold flex items-center gap-2 ${activeTab === 'buildings' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('buildings')}
          >
            Buildings
            {buildingsCount > 0 && (
              <span className="badge badge-sm badge-secondary">{buildingsCount}</span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <div
            id="base-panel-plans"
            role="tabpanel"
            aria-labelledby="base-tab-plans"
            hidden={activeTab !== 'plans'}
          >
            <BasePlansView />
          </div>
          <div
            id="base-panel-buildings"
            role="tabpanel"
            aria-labelledby="base-tab-buildings"
            hidden={activeTab !== 'buildings'}
          >
            <BaseBuildingsView />
          </div>
        </div>
      </div>

      <CreateProductionPlanModal />
    </div>
  );
};
