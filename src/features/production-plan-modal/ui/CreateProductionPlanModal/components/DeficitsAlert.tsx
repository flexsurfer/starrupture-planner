import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import { ItemImage } from '@/shared/ui';
import { formatQuantity } from '@/utils/formatQuantity';
import { getItemCategoryColor } from '@/utils/itemColors';

export const DeficitsAlert: React.FC = () => {
    const deficits = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS]);
    const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);

    if (deficits.length === 0) {
        return null;
    }

    return (
        <div className="px-4 py-2 shrink-0">
            <details open className="group rounded-lg border border-base-300 bg-base-200/50">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-base-content/85 hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Missing Materials</span>
                    <span className="text-xs font-normal text-base-content/50">{deficits.length}</span>
                    <svg aria-hidden="true" className="ml-auto size-4 shrink-0 text-base-content/50 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5 7 7-7 7" />
                    </svg>
                </summary>
                <div className="flex flex-wrap gap-2 px-3 pb-3">
                    {deficits.map(deficit => (
                        <div key={deficit.itemId} className="flex shrink-0 items-center gap-2 rounded-lg border border-base-300 px-2.5 py-1.5">
                            <ItemImage itemId={deficit.itemId} item={itemsById[deficit.itemId]} size="xsmall" />
                            <span className="text-sm font-medium whitespace-nowrap">{deficit.itemName}</span>
                            <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: getItemCategoryColor(itemsById[deficit.itemId]?.type) }}>
                                {formatQuantity(deficit.missing)}<span className="font-normal text-xs">/min</span>
                            </span>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
};
