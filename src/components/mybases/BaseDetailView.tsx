import React, { useCallback } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';
import { SUB_IDS } from '../../state/sub-ids';
import type { Base } from '../../state/db';
import { BaseCoreInfo, BaseBuildingsView, BasePlansView } from './index';

export const BaseDetailView: React.FC = () => {
  const selectedBase = useSubscription<Base | null>([SUB_IDS.SELECTED_BASE]);
  const activeTab = useSubscription<'plans' | 'buildings'>([SUB_IDS.BASE_DETAIL_ACTIVE_TAB]);

  const onBack = useCallback(() => {
    dispatch([EVENT_IDS.SET_SELECTED_BASE, null]);
  }, []);

  const handleTabChange = useCallback((tab: 'plans' | 'buildings') => {
    dispatch([EVENT_IDS.SET_BASE_DETAIL_ACTIVE_TAB, tab]);
  }, []);

  // Early return if no base selected
  if (!selectedBase) {
    return null;
  }

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

      {/* Tabs */}
      <div className="tabs tabs-bordered mb-4 flex-shrink-0">
        <button
          className={`tab ${activeTab === 'plans' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('plans')}
        >
          Plans
          {selectedBase.productionPlanSections && selectedBase.productionPlanSections.length > 0 && (
            <span className="badge badge-sm badge-primary ml-2">{selectedBase.productionPlanSections.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'buildings' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('buildings')}
        >
          Buildings
          {selectedBase.buildings && selectedBase.buildings.length > 0 && (
            <span className="badge badge-sm badge-secondary ml-2">{selectedBase.buildings.length}</span>
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'plans' && <BasePlansView />}
        {activeTab === 'buildings' && <BaseBuildingsView />}
      </div>
    </div>
  );
};
