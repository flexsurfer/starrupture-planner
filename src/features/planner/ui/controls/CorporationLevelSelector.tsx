import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { CorporationLevelSelection } from '@/app/uklad/model';
import { CorporationLevelSelector } from '@/features/corporations/ui';

/**
 * Wrapper that connects CorporationLevelSelector to planner global state.
 * Uses subscriptions for data and dispatches events for changes.
 */
export const PlannerCorporationLevelSelector: React.FC<{ className?: string }> = ({ className }) => {
    const runtime = useRuntime();
    const corporationLevels = useSubscription([appIds.subscriptions.PLANNER_AVAILABLE_CORPORATION_LEVELS]);
    const selectedLevel = useSubscription([appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL]);
    const targetAmount = useSubscription([appIds.subscriptions.PLANNER_TARGET_AMOUNT]);

    const handleChange = (level: CorporationLevelSelection | null) => {
        runtime.dispatch([appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL, level]);
    };

    return (
        <CorporationLevelSelector
            corporationLevels={corporationLevels}
            selectedLevel={selectedLevel}
            onChange={handleChange}
            targetAmount={targetAmount}
            className={className}
        />
    );
};
