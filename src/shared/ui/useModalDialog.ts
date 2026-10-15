import { useEffect, useRef } from 'react';

/** Native modality provides focus trapping, background inertness and stacked dialogs. */
export function useModalDialog(open = true) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!open || !dialog) return;
        const previousFocus = document.activeElement;
        const previousDialog = previousFocus?.closest('dialog');
        dialog.showModal();
        dialog.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus();
        return () => {
            dialog.close();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                previousFocus.focus({ preventScroll: true });
            } else if (previousDialog?.isConnected) {
                previousDialog.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus({ preventScroll: true });
            }
        };
    }, [open]);
    return ref;
}
