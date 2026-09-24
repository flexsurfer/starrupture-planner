import { useTranslation } from '@/shared/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { FlowNode } from '@/features/planner/types';

export interface NodeInputActions {
    renderInputDialog?: (node: FlowNode, onClose: () => void) => ReactNode;
    onRevertInput?: (node: FlowNode) => void;
    inputDisabledReason?: string;
}

export function NodeInputButton({ node, itemName, isExternal, renderInputDialog, onRevertInput, inputDisabledReason }: NodeInputActions & {
    node: FlowNode;
    itemName: string;
    isExternal: boolean;
}) {
    if (node.nodeType === 'launcher' || (isExternal ? !onRevertInput : !renderInputDialog)) return null;
    return <InputActionButton itemName={itemName} isExternal={isExternal} inputDisabledReason={inputDisabledReason}
        onRevertInput={() => onRevertInput?.(node)} renderInputDialog={close => renderInputDialog?.(node, close)} />;
}

export function InputActionButton({ itemName, isExternal, renderInputDialog, onRevertInput, inputDisabledReason, trash = false }: {
    itemName: string;
    isExternal: boolean;
    renderInputDialog?: (onClose: () => void) => ReactNode;
    onRevertInput?: () => void;
    inputDisabledReason?: string;
    trash?: boolean;
}) {
    const { t } = useTranslation();
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const button = useRef<HTMLButtonElement>(null);
    const modal = useRef<HTMLDivElement>(null);
    const close = () => {
        setContainer(null);
    };
    useEffect(() => {
        if (!container) return;
        const trigger = button.current;
        const dialogs = modal.current?.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
        const activeDialog = dialogs?.[dialogs.length - 1] ?? modal.current;
        (activeDialog?.querySelector<HTMLElement>('input') ?? activeDialog?.querySelector<HTMLElement>('button'))?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setContainer(null);
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            trigger?.focus();
        };
    }, [container]);

    const label = trash ? t("Remove external input for {itemName}", { itemName: itemName }) : isExternal ? t("Revert {itemName} to production", { itemName: itemName }) : t("Use external resource for {itemName}", { itemName: itemName });
    return <>
        <button ref={button} type="button" aria-label={label} aria-haspopup="dialog"
            title={inputDisabledReason || label} disabled={!!inputDisabledReason}
            className="nodrag nopan btn btn-xs size-6 min-h-6 shrink-0 rounded border border-base-content/20 bg-base-300 p-0 text-base-content/75 hover:border-primary hover:text-primary"
            onClick={event => {
                event.stopPropagation();
                setContainer(event.currentTarget.closest('dialog') ?? document.body);
            }}>
            <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {trash ? <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /> : isExternal ? <path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" />
                    : <><path d="M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4" /></>}
            </svg>
        </button>
        {container && createPortal(<div ref={modal} className="relative z-[1000] nodrag nopan nowheel"
            onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => {
                event.stopPropagation();
                if (event.key !== 'Tab') return;
                const dialogs = modal.current?.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
                const activeDialog = dialogs?.[dialogs.length - 1] ?? modal.current;
                const controls = activeDialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])');
                if (!controls?.length) return;
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }}>
            {isExternal ? <div className="modal modal-open">
                <div role="alertdialog" aria-modal="true" aria-label={t("Remove external input?")}
                    className="modal-box max-w-sm space-y-4">
                    <h3 className="text-lg font-semibold">{t("Remove external input?")}</h3>
                    <p>{t("Remove the external input for {itemName} and revert to production?", { itemName: itemName })}</p>
                    <div className="modal-action">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>{t("Cancel")}</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                            close();
                            onRevertInput?.();
                        }}>{t("Remove input")}</button>
                    </div>
                </div>
                <div className="modal-backdrop" onClick={close} />
            </div> : renderInputDialog?.(close)}
        </div>, container)}
    </>;
}
