import { useTranslation } from '@/shared/i18n';
import { useEffect, useRef, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { ItemImage } from '@/shared/ui';
import { useDropdownViewportPosition } from '@/shared/ui/useDropdownViewportPosition';
import { InputActionButton } from '../visualization/NodeInputButton';

export function PlannerExternalInputs() {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const inputs = useSubscription([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS]);
    const items = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const entries = Object.entries(inputs);
    const visible = open && entries.length > 0;
    const panelRef = useDropdownViewportPosition(visible, root);

    useEffect(() => {
        if (!visible) return;
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!root.current?.contains(target) && !target.closest('[role="alertdialog"], .modal')) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            root.current?.querySelector('button')?.focus();
        };
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [visible]);

    if (!entries.length) return null;
    return <div ref={root} className="relative">
        <button type="button" className="btn btn-sm btn-ghost gap-2 border border-base-300 bg-transparent hover:bg-base-200"
            aria-expanded={visible} onClick={() => setOpen(value => !value)}>
            <span className="text-xs font-semibold">{t("External")}</span>
            <span className="text-xs">{entries.length}</span>
            <span aria-hidden="true" className={`text-xs transition-transform ${visible ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {visible && <div ref={panelRef} className="fixed inset-x-2 bottom-2 z-30 flex max-h-[60vh] flex-col rounded-md border border-base-300 bg-base-100 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-[var(--dropdown-right,0px)] sm:mt-2 sm:w-80">
            <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
                <span className="text-sm font-semibold">{t("External inputs")}</span>
                <button type="button" className="btn btn-sm btn-ghost btn-square" aria-label={t("Close external inputs")} onClick={() => setOpen(false)}>✕</button>
            </div>
            <ul className="min-h-0 overflow-y-auto overscroll-contain p-2">
                {entries.map(([itemId, amount]) => {
                    const name = items[itemId]?.name ?? itemId;
                    return <li key={itemId} className="flex items-center gap-2 rounded px-2 py-2 hover:bg-base-200">
                        <ItemImage itemId={itemId} size="small" />
                        <span className="min-w-0 flex-1 text-xs">{name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-base-content/60">{t("{amount}/min", { amount: amount })}</span>
                        <InputActionButton itemName={name} isExternal trash onRevertInput={() => {
                            if (entries.length === 1) setOpen(false);
                            runtime.dispatch([appIds.events.PLANNER_REMOVE_EXTERNAL_INPUT, itemId]);
                        }} />
                    </li>;
                })}
            </ul>
        </div>}
    </div>;
}
