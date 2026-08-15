import { useCallback, useState } from 'react';
import { useAppRuntime, useAppSubscription, useSubscription } from '@/state/runtime';
import { appIds } from '@/app/uklad/catalog';
import { SUB_IDS } from '@/state/sub-ids';
import type { Base } from '@/state/db';
import type { BaseDetailTab } from './mybases';
import {
  EmptyState,
  BasesList,
  CreateBaseModal,
  ManageEnergyGroupsModal,
  BaseDetailView,
  MyBasesStats,
  MyBasesLogisticsView,
} from './mybases';

type MyBasesView = 'bases' | 'logistics';

const MyBasesPage = () => {
  const runtime = useAppRuntime();
  const bases = useAppSubscription([appIds.subscriptions.BASES_LIST]);
  const energyGroups = useAppSubscription([appIds.subscriptions.ENERGY_GROUPS_LIST]);
  const selectedBase = useSubscription<Base | null>([SUB_IDS.BASES_SELECTED_BASE]);
  const [activeView, setActiveView] = useState<MyBasesView>('bases');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnergyGroupsModal, setShowEnergyGroupsModal] = useState(false);

  // Handlers
  const handleCreateBase = useCallback((name: string) => {
    runtime.dispatch([appIds.events.BASES_CREATE_BASE, name]);
  }, [runtime]);

  const handleOpenBase = useCallback((baseId: string, tab: BaseDetailTab = 'base') => {
    runtime.dispatch([appIds.events.BASES_OPEN_BASE, baseId, tab]);
  }, [runtime]);

  const handleDeleteBase = useCallback((baseId: string) => {
    const base = bases.find(b => b.id === baseId);
    if (base) {
      runtime.dispatch([appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
        'Delete Base',
      `Are you sure you want to delete ${base.name}? This action cannot be undone.`,
      () => {
        runtime.dispatch([appIds.events.BASES_DELETE_BASE, baseId]);
      },
      {
        confirmLabel: 'Delete',
        confirmButtonClass: 'btn-error',
      }
      ]);
    }
  }, [bases, runtime]);

  // Render base detail view
  if (selectedBase) {
    return (
      <BaseDetailView />
    );
  }

  // Render overview
  return (
    <div className="h-full p-2 lg:p-3 flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4 mb-2 sm:mb-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 flex-wrap">
            <h1 className="text-2xl font-bold whitespace-nowrap">My Bases</h1>
            <div className="hidden sm:flex items-center gap-2">
              <MyBasesStats />
              <button
                className="btn btn-ghost btn-sm whitespace-nowrap"
                onClick={() => setShowEnergyGroupsModal(true)}
                title="Manage Energy Grids"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
                Energy Grids
                {energyGroups.length > 0 && (<span className="badge badge-sm badge-outline text-xs">
                  {energyGroups.length}
                </span>)}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm whitespace-nowrap"
              onClick={() => setShowCreateModal(true)}
            >
              Create Base
            </button>
          </div>
        </div>
        <div className="sm:hidden flex items-center gap-2 flex-wrap">
          <MyBasesStats />
          <button
            className="btn btn-ghost btn-sm whitespace-nowrap"
            onClick={() => setShowEnergyGroupsModal(true)}
            title="Manage Energy Grids"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
            </svg>
            Energy Grids
            <span className="badge badge-sm badge-neutral text-xs">
              {energyGroups.length}
            </span>
          </button>
        </div>
      </div>

      <div
        role="tablist"
        className="tabs tabs-bordered tabs-lg flex-shrink-0 mb-4 overflow-x-auto"
        aria-label="My Bases sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'bases'}
          id="my-bases-tab-bases"
          aria-controls="my-bases-panel-bases"
          className={`tab text-xl font-bold flex items-center gap-2 ${activeView === 'bases' ? 'tab-active' : ''}`}
          onClick={() => setActiveView('bases')}
        >
          Bases
          {bases.length > 0 && (
            <span className="badge badge-sm badge-primary">{bases.length}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'logistics'}
          id="my-bases-tab-logistics"
          aria-controls="my-bases-panel-logistics"
          className={`tab text-xl font-bold flex items-center gap-2 ${activeView === 'logistics' ? 'tab-active' : ''}`}
          onClick={() => setActiveView('logistics')}
        >
          Logistics
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeView === 'bases' && (
          <div
            id="my-bases-panel-bases"
            role="tabpanel"
            aria-labelledby="my-bases-tab-bases"
          >
            {bases.length === 0 ? (
              <EmptyState onCreateBase={() => setShowCreateModal(true)} />
            ) : (
              <BasesList
                bases={bases}
                onOpen={handleOpenBase}
                onDelete={handleDeleteBase}
              />
            )}
          </div>
        )}
        {activeView === 'logistics' && (
          <div
            id="my-bases-panel-logistics"
            role="tabpanel"
            aria-labelledby="my-bases-tab-logistics"
          >
            <MyBasesLogisticsView />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateBaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateBase}
      />
      <ManageEnergyGroupsModal
        isOpen={showEnergyGroupsModal}
        onClose={() => setShowEnergyGroupsModal(false)}
      />
    </div>
  );
};

export default MyBasesPage;
