import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { CorporationLevelInfo } from '../core/types';
import type { CorporationLevelSelection } from '../../../state/db';
import { CorporationLevelSelector } from '../../ui/CorporationLevelSelector';

/**
 * Wrapper that connects CorporationLevelSelector to planner global state.
 * Uses subscriptions for data and dispatches events for changes.
 */
export const PlannerCorporationLevelSelector: React.FC<{ className?: string }> = ({ className }) => {
    const corporationLevels = useSubscription<CorporationLevelInfo[]>([SUB_IDS.PLANNER_AVAILABLE_CORPORATION_LEVELS]);
    const selectedLevel = useSubscription<CorporationLevelSelection | null>([SUB_IDS.PLANNER_SELECTED_CORPORATION_LEVEL]);
    const targetAmount = useSubscription<number>([SUB_IDS.PLANNER_TARGET_AMOUNT]);

    const handleChange = (level: CorporationLevelSelection | null) => {
        dispatch([EVENT_IDS.PLANNER_SET_SELECTED_CORPORATION_LEVEL, level]);
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
