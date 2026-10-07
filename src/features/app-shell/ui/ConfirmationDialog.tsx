import { useTranslation, translateText } from '@/shared/i18n';
import React, { useEffect, useId, useRef } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

export const ConfirmationDialog: React.FC = () => {
    const { t } = useTranslation();
  const runtime = useRuntime();
  const dialog = useSubscription([appIds.subscriptions.UI_CONFIRMATION_DIALOG]);
  const dialogElement = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!dialog.isOpen) return;
    const element = dialogElement.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousDialog = previousFocus?.closest('dialog');
    element?.showModal();
    cancelButton.current?.focus();
    return () => {
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else previousDialog?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    };
  }, [dialog.isOpen]);

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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <dialog ref={dialogElement} className="modal" role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}
      onCancel={handleCancel} onClick={handleBackdropClick}>
      <div className="modal-box">
        <h3 id={`${id}-title`} className="font-bold text-lg mb-4">{translateText(t, dialog.title)}</h3>
        
        <p id={`${id}-message`} className="mb-6 whitespace-pre-line break-words">{translateText(t, dialog.message)}</p>

        <div className="modal-action">
          <button
            ref={cancelButton}
            type="button"
            className="btn btn-ghost"
            onClick={handleCancel}
          >
            {translateText(t, dialog.cancelLabel ?? '') || t("Cancel")}
          </button>
          <button
            type="button"
            className={`btn ${dialog.confirmButtonClass || 'btn-primary'}`}
            onClick={handleConfirm}
          >
            {translateText(t, dialog.confirmLabel ?? '') || t("Confirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
