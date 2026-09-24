import { useTranslation } from '@/shared/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { SettingsIcon } from '@/shared/ui/SettingsIcon';
import type { PlannerTab } from '../state';

function PlanSettingsDialog({ plan, onClose }: { plan: PlannerTab; onClose: () => void }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const [name, setName] = useState(plan.name);
    const dialog = useRef<HTMLDialogElement>(null);
    const id = useId();
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);
    return <dialog ref={dialog} className="modal" aria-labelledby={id} onCancel={onClose}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="modal-box max-w-md">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id={id} className="text-lg font-semibold">{t("Plan settings")}</h2>
                <button type="button" className="btn btn-sm btn-ghost btn-square" aria-label={t("Close plan settings")} onClick={onClose}>✕</button>
            </div>
            <form onSubmit={event => {
                event.preventDefault();
                if (!name.trim()) return;
                runtime.dispatch([appIds.events.PLANNER_RENAME_TAB, plan.id, name]);
                onClose();
            }}>
                <label className="flex flex-col gap-2 text-sm">{t("Plan name")}<input autoFocus required className="input input-bordered w-full" value={name} onChange={event => setName(event.target.value)} />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>{t("Cancel")}</button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={!name.trim() || name.trim() === plan.name}>{t("Rename plan")}</button>
                </div>
            </form>
            <div className="mt-5 border-t border-base-300 pt-4">
                <p className="mb-3 text-sm text-base-content/65">{t("Save this plan’s targets, amounts, recipes, and view settings to a file.")}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => {
                    runtime.dispatch([appIds.events.DATA_TRANSFER_EXPORT, { baseIds: [], planIds: [plan.id] }]);
                    onClose();
                }}>{t("Export plan")}</button>
            </div>
        </div>
    </dialog>;
}

export function PlanSettings() {
    const { t } = useTranslation();
    const plan = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB]);
    const [open, setOpen] = useState(false);
    if (!plan) return null;
    return <>
        <button type="button" className="btn btn-ghost btn-sm btn-square shrink-0" aria-label={t("Plan settings")} title={t("Plan settings")} onClick={() => setOpen(true)}>
            <SettingsIcon />
        </button>
        {open && <PlanSettingsDialog key={plan.id} plan={plan} onClose={() => setOpen(false)} />}
    </>;
}
