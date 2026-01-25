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
} from './mybases';

const MyBasesPage = () => {
  const bases = useSubscription<Base[]>([SUB_IDS.BASES]);
  const selectedBase = useSubscription<Base | null>([SUB_IDS.SELECTED_BASE]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renameBaseId, setRenameBaseId] = useState<string | null>(null);

  // Handlers
  const handleCreateBase = useCallback((name: string) => {
    dispatch([EVENT_IDS.CREATE_BASE, name]);
  }, []);

  const handleOpenBase = useCallback((baseId: string) => {
    dispatch([EVENT_IDS.SET_SELECTED_BASE, baseId]);
  }, []);

  const handleRenameBase = useCallback((baseId: string) => {
    setRenameBaseId(baseId);
  }, []);

  const handleConfirmRename = useCallback((baseId: string, newName: string) => {
    dispatch([EVENT_IDS.UPDATE_BASE_NAME, baseId, newName]);
    setRenameBaseId(null);
  }, []);

  const handleDeleteBase = useCallback((baseId: string) => {
    const base = bases.find(b => b.id === baseId);
    if (base) {
      dispatch([EVENT_IDS.SHOW_CONFIRMATION_DIALOG,
        'Delete Base',
        `Are you sure you want to delete ${base.name}? This action cannot be undone.`,
        () => {
          dispatch([EVENT_IDS.DELETE_BASE, baseId]);
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Bases</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Create Base
        </button>
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
