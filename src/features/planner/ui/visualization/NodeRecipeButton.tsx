import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FlowNode, Item } from '@/features/planner/types';
import { NodeRecipeModal } from './NodeRecipeModal';

export const NodeRecipeButton = ({ item, node }: { item: Item; node: FlowNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const close = () => {
        setIsOpen(false);
        buttonRef.current?.focus();
    };

    useEffect(() => {
        if (!isOpen) return;
        modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen]);

    return <>
        <button
            ref={buttonRef}
            type="button"
            className="nodrag nopan btn btn-xs h-5 min-h-5 w-5 shrink-0 rounded border border-base-content/25 bg-base-300 p-0 text-base-content/75 shadow-sm hover:border-base-content/40 hover:bg-base-content/15"
            title={`Recipes for ${item.name}`}
            aria-label={`Recipes for ${item.name}`}
            aria-haspopup="dialog"
            onClick={(event) => { event.stopPropagation(); setIsOpen(true); }}
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 3h14v18H5zM8 7h8M8 12h8M8 17h5" />
            </svg>
        </button>
        {isOpen && createPortal(
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Recipes for ${item.name}`}
                className="relative z-[1000] nodrag nopan nowheel"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== 'Tab') return;
                    const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
                    if (!buttons?.length) return;
                    const first = buttons[0];
                    const last = buttons[buttons.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }}
            >
                <NodeRecipeModal onClose={close} item={item} node={node} />
            </div>,
            document.body,
        )}
    </>;
};
