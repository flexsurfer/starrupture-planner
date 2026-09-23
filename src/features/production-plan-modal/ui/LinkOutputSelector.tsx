import { useMemo, useState } from 'react';
import type { LinkableOutputItem } from '@/features/bases/types';
import { BuildingImage, ItemImage } from '@/shared/ui';

interface LinkOutputSelectorProps {
    outputs: LinkableOutputItem[];
    onSelect: (output: LinkableOutputItem) => void;
    emptyMessage: string;
    compact?: boolean;
}

function formatRate(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function LinkOutputSelector({ outputs, onSelect, emptyMessage, compact = false }: LinkOutputSelectorProps) {
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

    return <div className="space-y-3">
        <input type="search" aria-label="Search outputs" className="input input-bordered input-sm w-full"
            placeholder="Search outputs..." value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)} autoFocus />
        <div className="max-h-[40vh] overflow-y-auto">
            {filteredOutputs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/65">
                    {emptyMessage}
                </div>
            ) : (
                <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {filteredOutputs.map((output) => {
                        const displayName = output.name || output.item.name;
                        return (
                            <button
                                key={`${output.baseId}:${output.baseBuildingId}`}
                                type="button"
                                onClick={() => onSelect(output)}
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
    </div>;
}
