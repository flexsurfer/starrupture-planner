import React from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useAppRuntime, useAppSubscription } from '@/state/runtime';

export const ConfirmationDialog: React.FC = () => {
  const runtime = useAppRuntime();
  const dialog = useAppSubscription([appIds.subscriptions.UI_CONFIRMATION_DIALOG]);

  if (!dialog.isOpen) {
    return null;
  }

  const handleConfirm = () => {
    dialog.onConfirm();
    runtime.dispatch([appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]);
  };

  const handleCancel = () => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    runtime.dispatch([appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]);
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
