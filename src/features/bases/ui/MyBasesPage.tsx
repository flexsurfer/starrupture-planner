import { useCallback, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import type { BaseDetailTab } from '@/features/bases/types';
import { EmptyState, BasesList, MyBasesStats } from './components';
import { BaseDetailView } from './BaseDetailView';
import { MyBasesLogisticsView } from './MyBasesLogisticsView';
import { CreateBaseModal } from './modals';
import { ManageEnergyGroupsModal } from '@/features/energy-groups/ui';

type MyBasesView = 'bases' | 'logistics';

const MyBasesPage = () => {
  const runtime = useRuntime();
  const bases = useSubscription([appIds.subscriptions.BASES_LIST]);
  const energyGroups = useSubscription([appIds.subscriptions.ENERGY_GROUPS_LIST]);
  const selectedBase = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE]);
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
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
        <MyBasesStats />
        <button
          type="button"
          className="btn btn-ghost btn-sm h-8 min-h-8 shrink-0 gap-1.5 px-2 text-xs whitespace-nowrap"
          onClick={() => setShowEnergyGroupsModal(true)}
          title="Manage Energy Grids"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
          Energy Grids
          {energyGroups.length > 0 && (
            <span className="badge badge-sm border-base-content/10 bg-base-content/5 text-base-content/60">
              {energyGroups.length}
            </span>
          )}
        </button>
      </div>

      <div className="mb-2 flex shrink-0 items-center gap-1">
        <div
          role="tablist"
          className="tabs tabs-bordered tabs-sm sm:tabs-md min-w-0 flex-1 flex-nowrap overflow-x-auto"
          aria-label="My Bases sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'bases'}
            id="my-bases-tab-bases"
            aria-controls="my-bases-panel-bases"
            className={`tab shrink-0 px-2 sm:px-3 text-xs sm:text-sm font-semibold flex flex-nowrap items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeView === 'bases' ? 'tab-active' : ''}`}
            onClick={() => setActiveView('bases')}
          >
            Bases
            {bases.length > 0 && (
              <span className="badge badge-sm border-base-content/10 bg-base-content/5 text-base-content/60">{bases.length}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'logistics'}
            id="my-bases-tab-logistics"
            aria-controls="my-bases-panel-logistics"
            className={`tab shrink-0 px-2 sm:px-3 text-xs sm:text-sm font-semibold flex flex-nowrap items-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeView === 'logistics' ? 'tab-active' : ''}`}
            onClick={() => setActiveView('logistics')}
          >
            Logistics
          </button>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary btn-outline h-8 min-h-8 min-w-8 shrink-0 gap-1 px-2 text-xs"
          aria-label="Create Base"
          title="Create Base"
          onClick={() => setShowCreateModal(true)}
        >
          <span aria-hidden="true">＋</span>
          <span className="hidden sm:inline">Create Base</span>
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
