import React from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { ActivatePlanDialog as ActivatePlanDialogType } from '../../../state/db';

export const ActivatePlanDialog: React.FC = () => {
  const dialog = useSubscription<ActivatePlanDialogType>([SUB_IDS.ACTIVATE_PLAN_DIALOG]);

  if (!dialog.isOpen || !dialog.baseId || !dialog.sectionId) {
    return null;
  }

  const hasMissingBuildings = dialog.allRequirementsSatisfied === false;

  const handleAddAll = () => {
    dispatch([EVENT_IDS.ACTIVATE_PRODUCTION_PLAN_SECTION, dialog.baseId!, dialog.sectionId!, 'addall']);
    dispatch([EVENT_IDS.CLOSE_ACTIVATE_PLAN_DIALOG]);
  };

  const handleAddMissing = () => {
    dispatch([EVENT_IDS.ACTIVATE_PRODUCTION_PLAN_SECTION, dialog.baseId!, dialog.sectionId!, 'missing']);
    dispatch([EVENT_IDS.CLOSE_ACTIVATE_PLAN_DIALOG]);
  };

  const handleActivateWithoutBuildings = () => {
    dispatch([EVENT_IDS.ACTIVATE_PRODUCTION_PLAN_SECTION, dialog.baseId!, dialog.sectionId!, 'dontadd']);
    dispatch([EVENT_IDS.CLOSE_ACTIVATE_PLAN_DIALOG]);
  };

  const handleCancel = () => {
    dispatch([EVENT_IDS.CLOSE_ACTIVATE_PLAN_DIALOG]);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Activate Production Plan</h3>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            onClick={handleCancel}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        <p className="mb-6">
          Do you want to add buildings from "{dialog.planName}" to your base?
        </p>

        <div className="space-y-3 mb-6">
          <button
            className="btn btn-primary w-full"
            onClick={handleAddAll}
          >
            Add All Buildings
          </button>
          {hasMissingBuildings && (
            <button
              className="btn btn-outline btn-primary w-full"
              onClick={handleAddMissing}
            >
              Add Only Missing Buildings
            </button>
          )}
          <button
            className="btn btn-ghost w-full"
            onClick={handleActivateWithoutBuildings}
          >
            Don't Add Anything
          </button>
        </div>

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleBackdropClick}></div>
    </div>
  );
};
