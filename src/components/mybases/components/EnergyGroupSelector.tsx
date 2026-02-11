import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { EnergyGroup } from '../../../state/db';

interface EnergyGroupSelectorProps {
  baseId: string;
  currentGroupId?: string;
  variant?: 'icon' | 'text';
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export const EnergyGroupSelector: React.FC<EnergyGroupSelectorProps> = ({
  baseId,
  currentGroupId,
  variant = 'icon',
}) => {
  const energyGroups = useSubscription<EnergyGroup[]>([SUB_IDS.ENERGY_GROUPS_LIST]);
  const [isOpen, setIsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  const normalizedNewName = useMemo(() => normalizeName(newGroupName), [newGroupName]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setNewGroupName('');
    if (dropdownRef.current) {
      dropdownRef.current.open = false;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, closeDropdown]);

  const handleSelect = useCallback((groupId: string | null) => {
    dispatch([EVENT_IDS.BASES_SET_ENERGY_GROUP, baseId, groupId]);
    closeDropdown();
  }, [baseId, closeDropdown]);

  const handleCreateAndAssign = useCallback(() => {
    if (!normalizedNewName) return;

    const existingGroup = energyGroups.find(
      (group) => normalizeName(group.name).toLowerCase() === normalizedNewName.toLowerCase(),
    );

    if (existingGroup) {
      dispatch([EVENT_IDS.BASES_SET_ENERGY_GROUP, baseId, existingGroup.id]);
    } else {
      dispatch([EVENT_IDS.ENERGY_GROUP_CREATE, normalizedNewName, baseId]);
    }

    closeDropdown();
  }, [baseId, closeDropdown, energyGroups, normalizedNewName]);

  const summaryClassName = variant === 'text'
    ? 'btn btn-xs btn-ghost gap-1 p-0 min-h-0 h-auto'
    : 'btn btn-xs btn-ghost btn-circle';

  return (
    <details
      ref={dropdownRef}
      className="dropdown dropdown-end"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className={summaryClassName} title="Change energy group">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
        {variant === 'text' ? (currentGroupId ? 'Change' : 'Assign') : null}
      </summary>

      <div className="dropdown-content bg-base-200 rounded-box z-10 w-56 p-2 shadow-lg space-y-2">
        <ul className="menu p-0">
          <li>
            <button type="button" className={!currentGroupId ? 'active' : ''} onClick={() => handleSelect(null)}>
              No Group
            </button>
          </li>
          {energyGroups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={currentGroupId === group.id ? 'active' : ''}
                onClick={() => handleSelect(group.id)}
              >
                {group.name}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-base-300 pt-2">
          <div className="text-[11px] uppercase tracking-wide text-base-content/60 mb-1">Create and assign</div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              className="input input-xs input-bordered flex-1"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Group name"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleCreateAndAssign();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-xs btn-primary"
              disabled={!normalizedNewName}
              onClick={handleCreateAndAssign}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </details>
  );
};
