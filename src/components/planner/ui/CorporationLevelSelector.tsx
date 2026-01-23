import React, { useEffect, useState } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { CorporationLevelInfo } from '../core/types';
import type { Corporation } from '../../../state/db';
import { CorporationUsageBadge } from '../../items';

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
    /** Selected item ID to calculate launcher stats */
    selectedItemId?: string | null;
    /** Target amount per minute to calculate building count */
    targetAmount?: number;
}

/**
 * Component for selecting which corporation level to use for cargo launcher
 * Shows compact stats inline with the selector
 * Uses subscriptions for both available levels and selected level
 * Auto-selects first level when levels become available
 */
export const CorporationLevelSelector: React.FC<CorporationLevelSelectorProps> = ({
    className = '',
    selectedItemId = null,
    targetAmount = 60
}) => {
    const corporationLevels = useSubscription<CorporationLevelInfo[]>([SUB_IDS.PLANNER_AVAILABLE_CORPORATION_LEVELS]);
    const selectedLevel = useSubscription<SelectedCorporationLevel | null>([SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL]);
    const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

    // Calculate launcher stats if we have selected level and item
    let itemsNeeded = 0;
    let launchTime = 0;
    let corporationName = '';
    let buildingCount = 0;

    if (selectedLevel && selectedItemId) {
        const corporation = corporations.find(c => c.id === selectedLevel.corporationId);
        if (corporation) {
            corporationName = corporation.name;
            const levelData = corporation.levels.find(l => l.level === selectedLevel.level);
            if (levelData) {
                const componentData = levelData.components.find(c => c.id === selectedItemId);
                if (componentData) {
                    itemsNeeded = componentData.cost ?? 0;
                    // Calculate building count: targetAmount / 10 items per minute per launcher
                    buildingCount = Math.max(1, targetAmount / 10);
                    // Launch Time = items needed / (10 items per minute * number of launchers)
                    launchTime = itemsNeeded / (10 * buildingCount);
                }
            }
        }
    }

    return (
        <div className={`relative ${className}`}>
            {/* Compact one-line display with stats */}
            <div 
                className="flex items-center gap-2 px-3 py-2 bg-base-200 border border-base-300 rounded-lg cursor-pointer hover:border-primary transition-colors"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
                {selectedLevel ? (
                    <>
                        <CorporationUsageBadge
                            usage={{
                                corporation: corporationName,
                                level: selectedLevel.level
                            }}
                            corporationId={selectedLevel.corporationId}
                        />
                        {/* Compact stats inline - only show if we have valid data */}
                        {selectedItemId && itemsNeeded > 0 && (
                            <>
                                <span className="text-xs text-base-content/40">|</span>
                                <span className="text-xs text-purple-500 font-semibold">{itemsNeeded} items</span>
                                <span className="text-xs text-yellow-500 font-semibold">{launchTime.toFixed(1)}min</span>
                            </>
                        )}
                    </>
                ) : (
                    <span className="text-xs text-base-content/60">Select corporation...</span>
                )}
                <svg 
                    className={`w-4 h-4 ml-auto transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Dropdown menu */}
            {isDropdownOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-base-200 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <ul className="menu p-3 gap-1">
                            {corporationLevels.map((levelInfo) => {
                                const isSelected = selectedLevel?.corporationId === levelInfo.corporationId && 
                                                  selectedLevel?.level === levelInfo.level;
                                return (
                                    <li key={`${levelInfo.corporationId}-${levelInfo.level}`}>
                                        <button
                                            className={`flex items-center gap-2 text-sm py-3 px-4 min-h-[44px] ${isSelected ? 'active' : ''}`}
                                            onClick={() => {
                                                dispatch([EVENT_IDS.SET_PLANNER_CORPORATION_LEVEL, {
                                                    corporationId: levelInfo.corporationId,
                                                    level: levelInfo.level
                                                }]);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            <img
                                                src={`./icons/corporations/${levelInfo.corporationId}.png`}
                                                alt={levelInfo.corporationName}
                                                className="w-6 h-6 rounded object-cover flex-shrink-0"
                                                onError={(e) => {
                                                    // Hide image if it fails to load
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            <span>{levelInfo.corporationName} - Level {levelInfo.level}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};