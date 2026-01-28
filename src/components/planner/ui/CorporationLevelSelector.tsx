import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { CorporationLevelInfo } from '../core/types';
import { CorporationLevelSelector, type SelectedCorporationLevel } from '../../ui/CorporationLevelSelector';

/**
 * Wrapper that connects CorporationLevelSelector to planner global state.
 * Uses subscriptions for data and dispatches events for changes.
 */
export const PlannerCorporationLevelSelector: React.FC<{ className?: string }> = ({ className }) => {
    const corporationLevels = useSubscription<CorporationLevelInfo[]>([SUB_IDS.PLANNER_AVAILABLE_CORPORATION_LEVELS]);
    const selectedLevel = useSubscription<SelectedCorporationLevel | null>([SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL]);
    const targetAmount = useSubscription<number>([SUB_IDS.TARGET_AMOUNT]);

    const handleChange = (level: SelectedCorporationLevel | null) => {
        dispatch([EVENT_IDS.SET_PLANNER_CORPORATION_LEVEL, level]);
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
