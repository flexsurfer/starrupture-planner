import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { EnergyGroup, Base } from '../../../state/db';

interface ManageEnergyGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

const EnergyGroupRow: React.FC<{
  group: EnergyGroup;
  memberCount: number;
  isNameTaken: (name: string, excludeId?: string) => boolean;
  onDelete: (group: EnergyGroup) => void;
}> = ({ group, memberCount, isNameTaken, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  useEffect(() => {
    if (!isEditing) {
      setEditName(group.name);
    }
  }, [group.name, isEditing]);

  const handleRename = useCallback(() => {
    const normalizedName = normalizeGroupName(editName);
    if (!normalizedName) {
      setEditName(group.name);
      setIsEditing(false);
      return;
    }

    const isDuplicateName = isNameTaken(normalizedName, group.id);
    if (isDuplicateName) {
      setEditName(group.name);
      setIsEditing(false);
      return;
    }

    if (normalizedName !== group.name) {
      dispatch([EVENT_IDS.ENERGY_GROUP_RENAME, group.id, normalizedName]);
    }

    setIsEditing(false);
  }, [editName, group.id, group.name, isNameTaken]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename();
      }
      if (e.key === 'Escape') {
        setEditName(group.name);
        setIsEditing(false);
      }
    },
    [handleRename, group.name],
  );

  return (
    <div className="bg-base-300 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 text-info flex-shrink-0"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
          />
        </svg>

        {isEditing ? (
          <input
            type="text"
            className="input input-bordered input-sm flex-1"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="flex-1 text-left font-medium text-sm hover:text-primary transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to rename"
          >
            {group.name}
          </button>
        )}

        <span className="text-xs text-base-content/60 whitespace-nowrap">
          {memberCount} base{memberCount !== 1 ? 's' : ''}
        </span>

        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => setIsEditing(true)}
          title="Rename"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
            />
          </svg>
        </button>

        <button
          type="button"
          className="btn btn-xs btn-ghost text-error"
          onClick={() => onDelete(group)}
          title="Delete group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const ManageEnergyGroupsModal: React.FC<ManageEnergyGroupsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const energyGroups = useSubscription<EnergyGroup[]>([SUB_IDS.ENERGY_GROUPS_LIST]);
  const bases = useSubscription<Base[]>([SUB_IDS.BASES_LIST]);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');

  const memberCountByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const base of bases) {
      if (base.energyGroupId) {
        map.set(base.energyGroupId, (map.get(base.energyGroupId) || 0) + 1);
      }
    }
    return map;
  }, [bases]);

  const linkedBasesCount = useMemo(() => {
    return bases.reduce((total, base) => total + (base.energyGroupId ? 1 : 0), 0);
  }, [bases]);

  const sortedGroups = useMemo(() => {
    return [...energyGroups].sort((a, b) => a.name.localeCompare(b.name));
  }, [energyGroups]);

  const normalizedNewName = useMemo(() => normalizeGroupName(newName), [newName]);

  const isNameTaken = useCallback((name: string, excludeId?: string) => {
    const normalized = normalizeGroupName(name).toLowerCase();
    if (!normalized) return false;
    return energyGroups.some((group) => {
      if (excludeId && group.id === excludeId) return false;
      return normalizeGroupName(group.name).toLowerCase() === normalized;
    });
  }, [energyGroups]);

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!normalizedNewName) {
        setCreateError('Enter a group name.');
        return;
      }

      if (isNameTaken(normalizedNewName)) {
        setCreateError('A group with this name already exists.');
        return;
      }

      dispatch([EVENT_IDS.ENERGY_GROUP_CREATE, normalizedNewName]);
      setNewName('');
      setCreateError('');
    },
    [normalizedNewName, isNameTaken],
  );

  const handleDelete = useCallback((group: EnergyGroup) => {
    const memberCount = memberCountByGroup.get(group.id) || 0;
    const baseLabel = memberCount === 1 ? 'base' : 'bases';
    const linkedMessage = memberCount > 0
      ? ` ${memberCount} ${baseLabel} will be unlinked from this grid.`
      : '';

    dispatch([
      EVENT_IDS.UI_SHOW_CONFIRMATION_DIALOG,
      'Delete Energy Group',
      `Delete "${group.name}"?${linkedMessage}`,
      () => dispatch([EVENT_IDS.ENERGY_GROUP_DELETE, group.id]),
      {
        confirmLabel: 'Delete',
        confirmButtonClass: 'btn-error',
      },
    ]);
  }, [memberCountByGroup]);

  const handleClose = useCallback(() => {
    setNewName('');
    setCreateError('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg">Manage Energy Groups</h3>
        <p className="text-sm text-base-content/70 mt-1 mb-4">
          {energyGroups.length} group{energyGroups.length !== 1 ? 's' : ''} across {linkedBasesCount} linked base{linkedBasesCount !== 1 ? 's' : ''}.
        </p>

        {/* Create new group */}
        <form onSubmit={handleCreate} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              className={`input input-bordered input-sm flex-1 ${createError ? 'input-error' : ''}`}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (createError) setCreateError('');
              }}
              placeholder="New group name"
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={!normalizedNewName}
            >
              Create
            </button>
          </div>
          {createError && (
            <p className="text-xs text-error mt-1">{createError}</p>
          )}
        </form>

        {/* Groups list */}
        {sortedGroups.length === 0 ? (
          <p className="text-sm text-base-content/60 text-center py-4">
            No energy groups yet. Create one above.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {sortedGroups.map((group) => (
              <EnergyGroupRow
                key={group.id}
                group={group}
                memberCount={memberCountByGroup.get(group.id) || 0}
                isNameTaken={isNameTaken}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose}></div>
    </div>
  );
};
