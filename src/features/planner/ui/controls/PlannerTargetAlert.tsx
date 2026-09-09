import { useEffect, useId, useRef } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

/** A modal alert keeps rejected target and recipe changes visible above other popups. */
export function PlannerTargetAlert() {
    const runtime = useRuntime();
    const warning = useSubscription([appIds.subscriptions.PLANNER_TARGET_WARNING]);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const messageId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (warning && !dialog.open) dialog.showModal();
        else if (!warning && dialog.open) dialog.close();
    }, [warning]);

    return <dialog ref={dialogRef} className="modal" role="alertdialog"
        aria-labelledby={titleId} aria-describedby={messageId}
        onClose={() => {
            if (warning) runtime.dispatch([appIds.events.PLANNER_DISMISS_TARGET_WARNING]);
        }}>
        <div className="modal-box max-w-md">
            <h2 id={titleId} className="text-lg font-semibold">Target conflict</h2>
            <p id={messageId} className="mt-3 text-sm">{warning}</p>
            <form method="dialog" className="modal-action">
                <button type="submit" autoFocus className="btn btn-sm btn-primary">OK</button>
            </form>
        </div>
    </dialog>;
}
