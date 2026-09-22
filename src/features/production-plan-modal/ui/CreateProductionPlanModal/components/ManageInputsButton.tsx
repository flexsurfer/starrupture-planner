import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { BuildingSectionCard } from '@/features/bases/ui/components/BuildingSectionCard';
import { SectionIcon } from '@/shared/ui';

const ManageInputsModal = ({ baseId, onClose }: { baseId: string; onClose: () => void }) => {
    const buildings = useSubscription([appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'inputs']);

    return (
        <div className="modal modal-open">
            <div role="dialog" aria-modal="true" aria-label="Manage inputs"
                className="modal-box flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0"
                // Keep the cards' fixed item dialogs positioned against the viewport.
                style={{ translate: 'none', scale: 'none' }}>
                <div className="border-b border-base-300 px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold">Manage inputs</h2>
                        <button type="button" className="btn btn-sm btn-circle btn-ghost"
                            aria-label="Close manage inputs" onClick={onClose}>✕</button>
                    </div>
                    <p className="mt-1 text-sm text-base-content/65">
                        All input buildings in this base. Changes apply immediately and can affect other plans using these inputs.
                    </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {buildings.length > 0 ? (
                        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                            {buildings.map(building => (
                                <BuildingSectionCard key={building.id} sectionBuilding={building} baseId={baseId} />
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-dashed border-base-300 p-5 text-sm text-base-content/65">
                            No input buildings in this base.
                        </p>
                    )}
                </div>
                <div className="flex justify-end border-t border-base-300 px-6 py-3">
                    <button type="button" className="btn btn-sm" onClick={onClose}>Done</button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

export const ManageInputsButton = () => {
    const baseId = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_ID]);
    const [isOpen, setIsOpen] = useState(false);

    return <>
        <button type="button" className="btn btn-sm btn-outline h-8 min-h-8 shrink-0 gap-1 px-2 text-xs"
            disabled={!baseId} onClick={() => setIsOpen(true)}>
            <SectionIcon name="buildings" className="size-3.5" />Manage inputs
        </button>
        {isOpen && baseId && <ManageInputsModal baseId={baseId} onClose={() => setIsOpen(false)} />}
    </>;
};
