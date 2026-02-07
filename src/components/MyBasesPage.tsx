import { useCallback, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { EVENT_IDS } from '../state/event-ids';
import type { Base } from '../state/db';
import {
  EmptyState,
  BasesList,
  CreateBaseModal,
  RenameBaseModal,
  BaseDetailView,
  MyBasesStats,
} from './mybases';

const MyBasesPage = () => {
  const bases = useSubscription<Base[]>([SUB_IDS.BASES_LIST]);
  const selectedBase = useSubscription<Base | null>([SUB_IDS.BASES_SELECTED_BASE]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      <BaseDetailView/>
    );
  }

  // Render overview
  const renameBase = bases.find(b => b.id === renameBaseId);

  return (
    <div className="h-full p-2 lg:p-3 flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4 mb-2 sm:mb-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <h1 className="text-2xl font-bold whitespace-nowrap">My Bases</h1>
            <div className="hidden sm:block">
              <MyBasesStats />
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm whitespace-nowrap"
            onClick={() => setShowCreateModal(true)}
          >
            Create Base
          </button>
        </div>
        <div className="sm:hidden">
          <MyBasesStats />
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
    </div>
  );
};

export default MyBasesPage;
