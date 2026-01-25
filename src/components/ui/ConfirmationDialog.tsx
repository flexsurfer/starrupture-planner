import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import { EVENT_IDS } from '../../state/event-ids';
import type { ConfirmationDialog as ConfirmationDialogType } from '../../state/db';

export const ConfirmationDialog: React.FC = () => {
  const dialog = useSubscription<ConfirmationDialogType>([SUB_IDS.CONFIRMATION_DIALOG]);

  if (!dialog.isOpen) {
    return null;
  }

  const handleConfirm = () => {
    dialog.onConfirm();
    dispatch([EVENT_IDS.CLOSE_CONFIRMATION_DIALOG]);
  };

  const handleCancel = () => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    dispatch([EVENT_IDS.CLOSE_CONFIRMATION_DIALOG]);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{dialog.title}</h3>
        
        <p className="mb-6">{dialog.message}</p>

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={handleCancel}
          >
            {dialog.cancelLabel || 'Cancel'}
          </button>
          <button
            className={`btn ${dialog.confirmButtonClass || 'btn-primary'}`}
            onClick={handleConfirm}
          >
            {dialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleBackdropClick}></div>
    </div>
  );
};
