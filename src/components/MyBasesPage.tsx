import { useCallback, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { EVENT_IDS } from '../state/event-ids';
import type { Base, EnergyGroup } from '../state/db';
import {
  EmptyState,
  BasesList,
  CreateBaseModal,
  RenameBaseModal,
  ManageEnergyGroupsModal,
  BaseDetailView,
  MyBasesStats,
} from './mybases';

const MyBasesPage = () => {
  const bases = useSubscription<Base[]>([SUB_IDS.BASES_LIST]);
  const energyGroups = useSubscription<EnergyGroup[]>([SUB_IDS.ENERGY_GROUPS_LIST]);
  const selectedBase = useSubscription<Base | null>([SUB_IDS.BASES_SELECTED_BASE]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnergyGroupsModal, setShowEnergyGroupsModal] = useState(false);
  const [renameBaseId, setRenameBaseId] = useState<string | null>(null);

  // Handlers
  const handleCreateBase = useCallback((name: string) => {
    dispatch([EVENT_IDS.BASES_CREATE_BASE, name]);
  }, []);

  const handleOpenBase = useCallback((baseId: string) => {
    dispatch([EVENT_IDS.BASES_SET_SELECTED_BASE, baseId]);
  }, []);

  const handleRenameBase = useCallback((baseId: string) => {
    setRenameBaseId(baseId);
  }, []);

  const handleConfirmRename = useCallback((baseId: string, newName: string) => {
    dispatch([EVENT_IDS.BASES_UPDATE_BASE_NAME, baseId, newName]);
    setRenameBaseId(null);
  }, []);

  const handleDeleteBase = useCallback((baseId: string) => {
    const base = bases.find(b => b.id === baseId);
    if (base) {
      dispatch([EVENT_IDS.UI_SHOW_CONFIRMATION_DIALOG,
        'Delete Base',
      `Are you sure you want to delete ${base.name}? This action cannot be undone.`,
      () => {
        dispatch([EVENT_IDS.BASES_DELETE_BASE, baseId]);
      },
      {
        confirmLabel: 'Delete',
        confirmButtonClass: 'btn-error',
      }
      ]);
    }
  }, [bases]);

  // Render base detail view
  if (selectedBase) {
    return (
      <BaseDetailView />
    );
  }

  // Render overview
  const renameBase = bases.find(b => b.id === renameBaseId);

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
              className="btn btn-outline btn-sm whitespace-nowrap"
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {bases.length === 0 ? (
          <EmptyState onCreateBase={() => setShowCreateModal(true)} />
        ) : (
          <BasesList
            bases={bases}
            onOpen={handleOpenBase}
            onRename={handleRenameBase}
            onDelete={handleDeleteBase}
          />
        )}
      </div>

      {/* Modals */}
      <CreateBaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateBase}
      />
      {renameBase && (
        <RenameBaseModal
          isOpen={renameBaseId !== null}
          baseId={renameBaseId}
          currentName={renameBase.name}
          onClose={() => setRenameBaseId(null)}
          onRename={handleConfirmRename}
        />
      )}
      <ManageEnergyGroupsModal
        isOpen={showEnergyGroupsModal}
        onClose={() => setShowEnergyGroupsModal(false)}
      />
    </div>
  );
};

export default MyBasesPage;
