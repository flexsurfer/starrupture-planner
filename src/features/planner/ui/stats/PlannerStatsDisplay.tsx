import { appIds } from '@/app/uklad/catalog';
import React, { useState } from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import { PlannerStatsModal } from './PlannerStatsModal';

/**
 * Component that displays production statistics summary with a button to show detailed stats
 * Handles both mobile and desktop layouts responsively
 */
export const PlannerStatsDisplay: React.FC = () => {
    const selectedItemId = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]);
    const statsForButton = useSubscription([appIds.subscriptions.PLANNER_STATS_SUMMARY]);
    const detailedStats = useSubscription([appIds.subscriptions.PLANNER_STATS_DETAILED]);

    // Stats modal state
    const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);

    // Invalid plans pause calculation, so don't present empty totals as requirements.
    if (!selectedItemId.length || !detailedStats.productionGroups.length) {
        return null;
    }

    const itemCount = detailedStats.sortedTypes.reduce(
        (sum, type) => sum + (detailedStats.itemsByType.get(type)?.length ?? 0),
        0,
    );

    return (
        <>
            <button
                type="button"
                className="btn btn-sm btn-ghost gap-2 border border-base-300 bg-transparent hover:bg-base-200 whitespace-nowrap text-xs"
                aria-haspopup="dialog"
                aria-expanded={isStatsModalOpen}
                aria-label={`Production statistics: ${statsForButton.totalBuildings} buildings, ${itemCount} items`}
                title={`Buildings: ${statsForButton.totalBuildings} · Items: ${itemCount} · Power ${statsForButton.totalEnergy.toFixed(0)} · Heat ${statsForButton.totalHotness.toFixed(0)}`}
                onClick={() => setIsStatsModalOpen(true)}
            >
                <span aria-hidden="true" className="inline-flex items-center gap-1.5 tabular-nums">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-base-content/70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M17 10h2a1 1 0 0 1 1 1v10M3 21h18" />
                        <path d="M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1M9 21v-3h3v3" />
                    </svg>
                    {statsForButton.totalBuildings}
                </span>
                <span aria-hidden="true" className="text-base-content/40">·</span>
                <span aria-hidden="true" className="inline-flex items-center gap-1.5 tabular-nums">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-base-content/70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m13 3 7 4a2 2 0 0 1 1 1.7v6.6a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4a2 2 0 0 1-1-1.7V8.7A2 2 0 0 1 4 7l7-4a2 2 0 0 1 2 0Z" />
                        <path d="m3.4 7.8 8.6 5 8.6-5M12 13v8.3M7.5 5 16 10" />
                    </svg>
                    {itemCount}
                </span>
                <span aria-hidden="true" className={`text-xs transition-transform ${isStatsModalOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Stats Modal */}
            <PlannerStatsModal
                isOpen={isStatsModalOpen}
                onClose={() => setIsStatsModalOpen(false)}
            />
        </>
    );
};
