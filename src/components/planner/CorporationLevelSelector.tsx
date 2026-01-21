import React, { useEffect } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import { EVENT_IDS } from '../../state/event-ids';
import type { CorporationLevelInfo } from './types';

interface SelectedCorporationLevel {
    corporationId: string;
    level: number;
}

/**
 * Props for the CorporationLevelSelector component
 */
interface CorporationLevelSelectorProps {
    /** CSS class name for styling */
    className?: string;
}

/**
 * Component for selecting which corporation level to use for cargo launcher
 * Uses subscriptions for both available levels and selected level
 * Auto-selects first level when levels become available
 */
export const CorporationLevelSelector: React.FC<CorporationLevelSelectorProps> = ({
    className = ''
}) => {
    const corporationLevels = useSubscription<CorporationLevelInfo[]>([SUB_IDS.PLANNER_AVAILABLE_CORPORATION_LEVELS]);
    const selectedLevel = useSubscription<SelectedCorporationLevel | null>([SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL]);

    // Auto-select first level when levels become available and none is selected
    useEffect(() => {
        if (corporationLevels.length > 0 && !selectedLevel) {
            const firstLevel = corporationLevels[0];
            dispatch([EVENT_IDS.SET_PLANNER_CORPORATION_LEVEL, {
                corporationId: firstLevel.corporationId,
                level: firstLevel.level
            }]);
        }
    }, [corporationLevels, selectedLevel]);

    if (corporationLevels.length === 0) {
        return null;
    }

    return (
        <div className={`form-control ${className}`}>
            <select
                className="select select-sm select-bordered w-full"
                value={selectedLevel ? `${selectedLevel.corporationId}-${selectedLevel.level}` : ''}
                onChange={(e) => {
                    const [corporationId, levelStr] = e.target.value.split('-');
                    const level = parseInt(levelStr, 10);
                    dispatch([EVENT_IDS.SET_PLANNER_CORPORATION_LEVEL, { corporationId, level }]);
                }}
            >
                <option value="" disabled>
                    Select corporation level...
                </option>
                {corporationLevels.map((levelInfo) => (
                    <option
                        key={`${levelInfo.corporationId}-${levelInfo.level}`}
                        value={`${levelInfo.corporationId}-${levelInfo.level}`}
                    >
                        {levelInfo.corporationName} - Level {levelInfo.level}
                    </option>
                ))}
            </select>
        </div>
    );
};