import { appIds } from '@/app/uklad/catalog';
import React, { useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { BaseCoreInfo } from './components';
import { BaseOverviewView } from './BaseOverviewView';
import { BaseBuildingsView } from './BaseBuildingsView';
import { RenameBaseModal } from './modals';
import { BasePlansView } from '@/features/production-plans/ui';
import { CreateProductionPlanModal } from '@/features/production-plan-modal/ui';
import type { BaseDetailTab } from '@/features/bases/types';

export const BaseDetailView: React.FC = () => {
  const runtime = useRuntime();
  const selectedBase = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE]);
  const activeTab = useSubscription([appIds.subscriptions.BASES_SELECTED_DETAIL_TAB]) || 'base';
  const [showRenameModal, setShowRenameModal] = useState(false);
  const setActiveTab = (tab: BaseDetailTab) => {
    runtime.dispatch([appIds.events.BASES_SET_DETAIL_TAB, tab]);
  };

  // Early return if no base selected
  if (!selectedBase) {
    return null;
  }

  const plansCount = selectedBase.productions?.length || 0;
  const buildingsCount = selectedBase.buildings?.length || 0;
  const handleRenameBase = (baseId: string, newName: string) => {
    runtime.dispatch([appIds.events.BASES_UPDATE_BASE_NAME, baseId, newName]);
    setShowRenameModal(false);
  };

  return (
    <div className="h-full p-2 lg:p-3 flex flex-col">
      {/* Core Info and Stats - Fixed, not scrollable */}
      <div className="mb-2 flex-shrink-0">
        <BaseCoreInfo onRename={() => setShowRenameModal(true)} />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-2 flex shrink-0 items-center gap-1">
          <div
            role="tablist"
            className="tabs tabs-bordered tabs-sm sm:tabs-md min-w-0 flex-1 flex-nowrap overflow-x-auto"
            aria-label="Base sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'base'}
              id="base-tab-overview"
              aria-controls="base-panel-overview"
              className={`tab shrink-0 px-2 sm:px-3 text-xs sm:text-sm font-semibold flex flex-nowrap items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeTab === 'base' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('base')}
            >
              Production
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'plans'}
              id="base-tab-plans"
              aria-controls="base-panel-plans"
              className={`tab shrink-0 px-2 sm:px-3 text-xs sm:text-sm font-semibold flex flex-nowrap items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeTab === 'plans' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('plans')}
            >
              Plans
              {plansCount > 0 && (
                <span className="badge badge-sm border-base-content/10 bg-base-content/5 text-base-content/60">{plansCount}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'buildings'}
              id="base-tab-buildings"
              aria-controls="base-panel-buildings"
              className={`tab shrink-0 px-2 sm:px-3 text-xs sm:text-sm font-semibold flex flex-nowrap items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeTab === 'buildings' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('buildings')}
            >
              Buildings
              {buildingsCount > 0 && (
                <span className="badge badge-sm border-base-content/10 bg-base-content/5 text-base-content/60">{buildingsCount}</span>
              )}
            </button>
          </div>
          <button type="button"
            className="btn btn-sm btn-primary btn-outline h-8 min-h-8 min-w-8 shrink-0 gap-1 px-2 text-xs"
            aria-label="Add Plan" title="Add Plan"
            onClick={() => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN])}>
            <span aria-hidden="true">＋</span><span className="hidden sm:inline">Add Plan</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {activeTab === 'base' && (
            <div
              id="base-panel-overview"
              role="tabpanel"
              aria-labelledby="base-tab-overview"
            >
              <BaseOverviewView />
            </div>
          )}
          {activeTab === 'plans' && (
            <div
              id="base-panel-plans"
              role="tabpanel"
              aria-labelledby="base-tab-plans"
            >
              <BasePlansView />
            </div>
          )}
          {activeTab === 'buildings' && (
            <div
              id="base-panel-buildings"
              role="tabpanel"
              aria-labelledby="base-tab-buildings"
            >
              <BaseBuildingsView />
            </div>
          )}
        </div>
      </div>

      <CreateProductionPlanModal />
      <RenameBaseModal
        isOpen={showRenameModal}
        baseId={selectedBase.id}
        currentName={selectedBase.name}
        onClose={() => setShowRenameModal(false)}
        onRename={handleRenameBase}
      />
    </div>
  );
};
