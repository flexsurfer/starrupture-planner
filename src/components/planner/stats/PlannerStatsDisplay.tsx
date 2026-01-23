import React, { useState } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { PlannerStatsModal } from './PlannerStatsModal';

/**
 * Component that displays production statistics summary with a button to show detailed stats
 * Handles both mobile and desktop layouts responsively
 */
export const PlannerStatsDisplay: React.FC = () => {
    const selectedItemId = useSubscription<string | null>([SUB_IDS.SELECTED_PLANNER_ITEM]);
    const statsForButton = useSubscription<{ totalBuildings: number; totalEnergy: number; totalHotness: number }>([SUB_IDS.PLANNER_STATS_SUMMARY]);

    // Stats modal state
    const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);

    // Don't render if no item is selected
    if (!selectedItemId) {
        return null;
    }

    return (
        <>
            {/* Mobile Layout */}
            <div className="flex items-center gap-2 sm:hidden">
                🏭{statsForButton.totalBuildings}
                <span className="text-xs text-base-content/40">|</span>
                ⚡{statsForButton.totalEnergy.toFixed(0)}
                <span className="text-xs text-base-content/40">|</span>
                🔥{statsForButton.totalHotness.toFixed(0)}
                <button
                    className="btn btn-sm"
                    onClick={() => setIsStatsModalOpen(true)}
                >
                    Show Stats
                </button>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center gap-2">
                🏭{statsForButton.totalBuildings}
                <span className="text-xs text-base-content/40">|</span>
                ⚡{statsForButton.totalEnergy.toFixed(0)}
                <span className="text-xs text-base-content/40">|</span>
                🔥{statsForButton.totalHotness.toFixed(0)}
                <button
                    className="btn btn-sm lg:btn-md"
                    onClick={() => setIsStatsModalOpen(true)}
                >
                    Show Stats
                </button>
            </div>

            {/* Stats Modal */}
            <PlannerStatsModal
                isOpen={isStatsModalOpen}
                onClose={() => setIsStatsModalOpen(false)}
            />
        </>
    );
};
