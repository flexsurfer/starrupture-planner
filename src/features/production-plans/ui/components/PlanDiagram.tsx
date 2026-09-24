import { useTranslation } from '@/shared/i18n';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { ProductionFlowResult } from '@/features/planner/types';
import { EmbeddedFlowDiagram } from './EmbeddedFlowDiagram';
import { usePlanInputActions } from '@/features/production-plan-modal/ui/usePlanInputActions';

const portraitQuery = '(max-width: 639px)';
const subscribeToWidth = (onChange: () => void) => {
    const query = window.matchMedia?.(portraitQuery);
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
};
const isNarrowScreen = () => window.matchMedia?.(portraitQuery).matches ?? false;

export const PlanDiagram = ({ productionFlow, name, targetItemId, baseId, planId }: { productionFlow: ProductionFlowResult; name: string; targetItemId: string; baseId: string; planId: string }) => {
    const { t } = useTranslation();
    const inputActions = usePlanInputActions(baseId, planId);
    const [expanded, setExpanded] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const narrowScreen = useSyncExternalStore(subscribeToWidth, isNarrowScreen, () => false);
    const direction = narrowScreen ? 'TB' : 'LR';

    useEffect(() => {
        if (!expanded) return;
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, [expanded]);

    if (productionFlow.nodes.length === 0) {
        return <p className="py-12 text-center text-sm text-base-content/60">{t("No production flow to display.")}</p>;
    }

    return <>
        <div className="relative h-[clamp(320px,60dvh,720px)] overflow-hidden rounded-b-lg" role="region" aria-label={t("{name} diagram", { name: name })}>
            {!expanded && <EmbeddedFlowDiagram targetItemId={targetItemId} productionFlow={productionFlow} className="size-full" zoomOnScroll={false} direction={direction} {...inputActions} inputDisabledReason="Open the full-screen diagram to edit inputs" />}
            <button type="button" className="btn btn-sm absolute top-2 right-2 z-10 h-8 min-h-8 gap-1.5 border-base-300 bg-base-200 px-2 text-xs"
                aria-label={t("Expand {name} diagram", { name: name })} aria-haspopup="dialog" onClick={() => setExpanded(true)}>
                <svg aria-hidden="true" className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4" /></svg>{t("Full screen")}</button>
        </div>
        <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setExpanded(false)}
            className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none flex-col overflow-hidden border-0 bg-base-100 p-0 text-base-content open:flex">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-base-300 bg-base-200 p-2 sm:px-4">
                <h2 id={titleId} className="min-w-0 text-sm font-semibold break-words">{name}</h2>
                <button type="button" className="btn btn-sm btn-ghost h-8 min-h-8 shrink-0 px-2 text-xs" onClick={() => setExpanded(false)}>{t("Close diagram")}</button>
            </div>
            {expanded && <EmbeddedFlowDiagram targetItemId={targetItemId} productionFlow={productionFlow} className="min-h-0 flex-1" direction={direction} {...inputActions} />}
        </dialog>
    </>;
};
