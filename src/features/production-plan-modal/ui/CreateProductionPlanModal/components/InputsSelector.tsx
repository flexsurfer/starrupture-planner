import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useId, useRef } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { ItemImage, BuildingImage } from '@/shared/ui';
import { formatQuantity } from '@/utils/formatQuantity';
import { getItemCategoryColor } from '@/utils/itemColors';

export const InputsSelector: React.FC = () => {
    const runtime = useRuntime();
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollId = useId();
    const scrollInputs = (direction: number) => {
        const container = scrollRef.current;
        if (!container) return;
        container.scrollBy({ left: direction * Math.max(160, container.clientWidth * 0.8), behavior: 'smooth' });
    };
    const { inputItems, selectedInputIds } = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA]);
    const handleInputToggle = useCallback((baseBuildingId: string) => {
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, baseBuildingId]);
    }, [runtime]);

    return (
        <div className="px-4 py-2 border-b border-base-300 flex-shrink-0 bg-base-200/50">
            <div className="flex flex-col gap-2">
                {inputItems.length === 0 ? (
                    <div className="rounded-lg border border-base-300 bg-base-200/40 px-3 py-2">
                        <div className="flex items-start gap-2 text-base-content/65">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4 mt-0.5" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs">
                            Add buildings to the Inputs section to provide materials for production
                        </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            aria-label="Scroll inputs left"
                            aria-controls={scrollId}
                            className="btn btn-sm btn-ghost btn-square shrink-0 border-base-300"
                            onClick={() => scrollInputs(-1)}
                        >
                            <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <div ref={scrollRef} id={scrollId} role="region" aria-label="Production plan inputs" tabIndex={0} className="flex min-w-0 flex-1 flex-nowrap items-stretch gap-2 overflow-x-auto pb-1">
                            {inputItems.map((inputItem) => {
                                const isSelected = selectedInputIds.includes(inputItem.baseBuildingId);
                                const hasLinkError = !!inputItem.linkedOutput && inputItem.linkedOutput.status !== 'ok';
                                const linkLabel = inputItem.linkedOutput
                                    ? `${inputItem.linkedOutput.baseName} / ${inputItem.linkedOutput.outputName}`
                                    : '';
                                return (
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        key={inputItem.baseBuildingId}
                                        onClick={() => handleInputToggle(inputItem.baseBuildingId)}
                                        className={`flex shrink-0 flex-col gap-1 border rounded-lg px-2.5 py-1.5 text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                                            hasLinkError
                                                ? 'bg-error/10 border-error'
                                                : isSelected
                                                ? 'bg-primary/10 border-primary'
                                                : 'border-base-300 hover:bg-base-300/50'
                                        }`}
                                        title={inputItem.linkedOutput
                                            ? `${linkLabel} - ${inputItem.item.name} - ${inputItem.ratePerMinute}/min`
                                            : `${inputItem.building.name}: ${inputItem.item.name} - ${inputItem.ratePerMinute}/min`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <ItemImage
                                                itemId={inputItem.item.id}
                                                item={inputItem.item}
                                                size="xsmall"
                                            />
                                            <span className="text-sm font-medium whitespace-nowrap">{inputItem.item.name}</span>
                                            <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: getItemCategoryColor(inputItem.item.type) }}>{formatQuantity(inputItem.ratePerMinute)}<span className="font-normal text-xs">/min</span></span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-base-content/45" title={inputItem.description}>
                                            <BuildingImage
                                                buildingId={inputItem.building.id}
                                                building={inputItem.building}
                                                size="small"
                                                className="!w-3.5 !h-3.5 opacity-60"
                                            />
                                            <span className="text-xs max-w-64 truncate">{inputItem.name || inputItem.building.name}</span>
                                            {inputItem.linkedOutput && (
                                                <span
                                                    className={`badge badge-xs shrink-0 max-w-64 truncate ${hasLinkError ? 'badge-error' : 'badge-outline'}`}
                                                    title={linkLabel}
                                                >
                                                    {hasLinkError ? 'Link broken' : linkLabel}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            aria-label="Scroll inputs right"
                            aria-controls={scrollId}
                            className="btn btn-sm btn-ghost btn-square shrink-0 border-base-300"
                            onClick={() => scrollInputs(1)}
                        >
                            <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 6 6 6-6 6" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
