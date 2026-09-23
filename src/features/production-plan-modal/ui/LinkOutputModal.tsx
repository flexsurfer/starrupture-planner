import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import type { LinkableOutputItem } from '@/features/bases/types';
import { LinkOutputSelector } from './LinkOutputSelector';
import { AdvancedModeSwitch } from '@/features/bases/ui/components/AdvancedModeSwitch';

interface LinkOutputModalProps {
    isOpen: boolean;
    showModeSwitch?: boolean;
    baseId?: string;
    planId?: string;
    itemId?: string;
    title?: string;
    onClose: () => void;
    onSelect: (output: LinkableOutputItem) => void;
}

const EMPTY_LINKABLE_OUTPUTS: LinkableOutputItem[] = [];

export const LinkOutputModal: React.FC<LinkOutputModalProps> = ({ isOpen, onClose, onSelect, showModeSwitch = false, baseId, planId, itemId, title }) => {
    const planning = useSubscription([appIds.subscriptions.BASES_MODE]) === 'planning';
    const outputs = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, baseId ?? null, planId ?? null, itemId ?? null]) || EMPTY_LINKABLE_OUTPUTS;
    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div role="dialog" aria-modal="true" aria-label={title ?? (planning ? 'Add external item' : 'Link Output')} className="modal-box max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b border-base-300">
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="mr-auto font-bold text-lg">{title ?? (planning ? 'Add external item' : 'Link Output')}</h3>
                        {showModeSwitch && <AdvancedModeSwitch />}
                        <button
                            type="button"
                            className="btn btn-sm btn-circle btn-ghost"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <LinkOutputSelector outputs={outputs} onSelect={onSelect}
                        emptyMessage={planning ? 'No available outputs found. Create a plan in another base, or configure a free output in Advanced mode.' : 'No configured outputs found.'} />
                </div>

                <div className="px-6 py-3 border-t border-base-300 flex justify-end">
                    <button type="button" className="btn btn-sm" onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
};
