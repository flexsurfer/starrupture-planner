import React, { useState } from 'react';
import type { CorporationLevelInfo } from '../planner/core/types';
import { CorporationUsageBadge } from '../items';

export interface SelectedCorporationLevel {
    corporationId: string;
    level: number;
}

/**
 * Props for the CorporationLevelSelector component
 */
interface CorporationLevelSelectorProps {
    /** Available corporation levels to choose from */
    corporationLevels: CorporationLevelInfo[];
    /** Currently selected corporation level */
    selectedLevel: SelectedCorporationLevel | null;
    /** Callback when corporation level changes */
    onChange: (level: SelectedCorporationLevel | null) => void;
    /** Target amount for stats calculation */
    targetAmount?: number;
    /** CSS class name for styling */
    className?: string;
}

/**
 * Simple controlled component for selecting corporation level.
 * Can be used anywhere - just pass the required props.
 */
export const CorporationLevelSelector: React.FC<CorporationLevelSelectorProps> = ({
    corporationLevels,
    selectedLevel,
    onChange,
    targetAmount = 60,
    className = ''
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    if (corporationLevels.length === 0) {
        return null;
    }

    // Find the selected level info for stats
    const selectedLevelInfo = selectedLevel 
        ? corporationLevels.find(l => l.corporationId === selectedLevel.corporationId && l.level === selectedLevel.level)
        : null;

    // Calculate launcher stats if we have selected level
    let itemsNeeded = 0;
    let launchTime = 0;
    let corporationName = '';

    if (selectedLevelInfo) {
        corporationName = selectedLevelInfo.corporationName;
        itemsNeeded = selectedLevelInfo.cost ?? 0;
        // Calculate building count: targetAmount / 10 items per minute per launcher
        const buildingCount = Math.max(1, targetAmount / 10);
        // Launch Time = items needed / (10 items per minute * number of launchers)
        launchTime = itemsNeeded / (10 * buildingCount);
    }

    return (
        <div className={`relative ${className}`}>
            {/* Compact one-line display with stats */}
            <div 
                className="flex items-center gap-2 px-3 h-8 bg-base-200 border border-base-300 rounded-lg cursor-pointer hover:border-primary transition-colors"
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
                        {itemsNeeded > 0 && (
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
                            {/* Clear/None option */}
                            <li>
                                <button
                                    className={`flex items-center gap-2 text-sm py-3 px-4 min-h-[44px] ${!selectedLevel ? 'active' : ''}`}
                                    onClick={() => {
                                        onChange(null);
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <span className="text-base-content/60">None</span>
                                </button>
                            </li>
                            {corporationLevels.map((levelInfo) => {
                                const isSelected = selectedLevel?.corporationId === levelInfo.corporationId && 
                                                  selectedLevel?.level === levelInfo.level;
                                return (
                                    <li key={`${levelInfo.corporationId}-${levelInfo.level}`}>
                                        <button
                                            className={`flex items-center gap-2 text-sm py-3 px-4 min-h-[44px] ${isSelected ? 'active' : ''}`}
                                            onClick={() => {
                                                onChange({
                                                    corporationId: levelInfo.corporationId,
                                                    level: levelInfo.level
                                                });
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
