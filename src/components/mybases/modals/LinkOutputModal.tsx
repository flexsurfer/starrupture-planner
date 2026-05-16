import React, { useMemo, useState } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import type { LinkableOutputItem } from '../types';
import { BuildingImage } from '../../ui/BuildingImage';
import { ItemImage } from '../../ui/ItemImage';

interface LinkOutputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (output: LinkableOutputItem) => void;
}

const EMPTY_LINKABLE_OUTPUTS: LinkableOutputItem[] = [];

function formatRate(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export const LinkOutputModal: React.FC<LinkOutputModalProps> = ({ isOpen, onClose, onSelect }) => {
    const outputs = useSubscription<LinkableOutputItem[]>([SUB_IDS.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS]) || EMPTY_LINKABLE_OUTPUTS;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOutputs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return outputs;

        return outputs.filter((output) => {
            const haystack = [
                output.baseName,
                output.name,
                output.description,
                output.item.name,
                output.item.id,
                output.building.name,
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [outputs, searchQuery]);

    if (!isOpen) return null;

    const handleSelect = (output: LinkableOutputItem) => {
        onSelect(output);
        setSearchQuery('');
    };

    const handleClose = () => {
        setSearchQuery('');
        onClose();
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b border-base-300">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-lg">Link Output</h3>
                        <button
                            type="button"
                            className="btn btn-sm btn-circle btn-ghost"
                            onClick={handleClose}
                            aria-label="Close modal"
                        >
                            ✕
                        </button>
                    </div>
                    <input
                        type="text"
                        className="input input-bordered input-sm w-full mt-3"
                        placeholder="Search outputs..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {filteredOutputs.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/65">
                            No configured outputs found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {filteredOutputs.map((output) => {
                                const displayName = output.name || output.item.name;
                                return (
                                    <button
                                        key={`${output.baseId}:${output.baseBuildingId}`}
                                        type="button"
                                        onClick={() => handleSelect(output)}
                                        className="rounded-lg border border-base-300 bg-base-100 hover:border-primary hover:bg-primary/5 px-3 py-2 text-left transition-colors"
                                        title={`${output.baseName}: ${output.item.name} - ${formatRate(output.ratePerMinute)}/min`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <BuildingImage
                                                    buildingId={output.building.id}
                                                    building={output.building}
                                                    size="small"
                                                    className="w-5 h-5"
                                                />
                                                <ItemImage
                                                    itemId={output.item.id}
                                                    item={output.item}
                                                    size="small"
                                                    className="w-5 h-5"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="font-medium text-sm truncate">{displayName}</span>
                                                    {output.isCurrentBase && (
                                                        <span className="badge badge-xs badge-outline shrink-0">This base</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-base-content/65 truncate">
                                                    {output.baseName} / {output.building.name}
                                                </div>
                                                <div className="text-xs text-base-content/80 mt-1">
                                                    {output.item.name} - {formatRate(output.ratePerMinute)}/min
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-base-300 flex justify-end">
                    <button type="button" className="btn btn-sm" onClick={handleClose}>
                        Cancel
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={handleClose}></div>
        </div>
    );
};
