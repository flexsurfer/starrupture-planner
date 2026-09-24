import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React, { useState } from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import { PlannerStatsModal } from './PlannerStatsModal';
import { SectionIcon } from '@/shared/ui';

/**
 * Component that displays production statistics summary with a button to show detailed stats
 * Handles both mobile and desktop layouts responsively
 */
export const PlannerStatsDisplay: React.FC = () => {
    const { t } = useTranslation();
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
                aria-label={t("Production statistics: {totalBuildings} buildings, {itemCount} items", { totalBuildings: statsForButton.totalBuildings, itemCount: itemCount })}
                title={t("Buildings: {totalBuildings} · Items: {itemCount} · Power {value} · Heat {value2}", { totalBuildings: statsForButton.totalBuildings, itemCount: itemCount, value: statsForButton.totalEnergy.toFixed(0), value2: statsForButton.totalHotness.toFixed(0) })}
                onClick={() => setIsStatsModalOpen(true)}
            >
                <span aria-hidden="true" className="inline-flex items-center gap-1.5 tabular-nums">
                    <SectionIcon name="buildings" className="h-4 w-4 text-base-content/70" />
                    {statsForButton.totalBuildings}
                </span>
                <span aria-hidden="true" className="text-base-content/40">·</span>
                <span aria-hidden="true" className="inline-flex items-center gap-1.5 tabular-nums">
                    <SectionIcon name="items" className="h-4 w-4 text-base-content/70" />
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
