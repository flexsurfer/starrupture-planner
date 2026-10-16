import { useTranslation } from '@/shared/i18n';
import React, { useEffect, useId, useRef, useState } from 'react';
import type { CorporationLevelInfo } from '@/features/planner/types';
import type { CorporationLevelSelection } from '@/app/uklad/model';
import { CorporationUsageBadge } from './CorporationUsageBadge';
import { useDropdownViewportPosition } from '@/shared/ui/useDropdownViewportPosition';

export type SelectedCorporationLevel = CorporationLevelSelection;

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
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const panelRef = useDropdownViewportPosition(isDropdownOpen && corporationLevels.length > 0, rootRef);

    useEffect(() => {
        if (!isDropdownOpen) return;
        const onMouseDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsDropdownOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setIsDropdownOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [isDropdownOpen]);

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
        <div ref={rootRef} className={`relative ${className}`}>
            {/* Compact one-line display with stats */}
            <button
                ref={triggerRef}
                type="button"
                className="btn btn-sm btn-ghost h-auto min-h-8 max-w-full flex-wrap gap-2 border border-base-300 bg-transparent py-1 hover:bg-base-200"
                aria-expanded={isDropdownOpen}
                aria-controls={panelId}
                onClick={() => setIsDropdownOpen(open => !open)}
            >
                <span className="text-xs font-semibold">{t("Corporations")}</span>
                {selectedLevel && (
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
                                <span className="text-xs text-purple-500 font-semibold">{t("{count} items", { count: itemsNeeded })}</span>
                                <span className="text-xs text-yellow-500 font-semibold">{t("{launchTime}min", { launchTime: launchTime.toFixed(1) })}</span>
                            </>
                        )}
                    </>
                )}
                <span aria-hidden="true" className={`text-xs transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
                <div ref={panelRef} id={panelId} className="absolute top-full right-[var(--dropdown-right,0px)] mt-2 z-30 w-[min(92vw,24rem)] bg-base-100 border border-base-300 rounded-xl shadow-xl max-h-60 overflow-auto">
                    <ul className="menu p-3 gap-1">
                        {/* Clear/None option */}
                        <li>
                            <button
                                type="button"
                                aria-pressed={!selectedLevel}
                                className={`flex items-center gap-2 text-sm py-3 px-4 min-h-[44px] ${!selectedLevel ? 'active' : ''}`}
                                onClick={() => {
                                    onChange(null);
                                    setIsDropdownOpen(false);
                                }}
                            >
                                <span className="text-base-content/60">{t("None")}</span>
                            </button>
                        </li>
                        {corporationLevels.map((levelInfo) => {
                            const isSelected = selectedLevel?.corporationId === levelInfo.corporationId &&
                                              selectedLevel?.level === levelInfo.level;
                            return (
                                <li key={`${levelInfo.corporationId}-${levelInfo.level}`}>
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
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
                                            src={`${import.meta.env.BASE_URL}icons/corporations/${levelInfo.corporationId}.webp`}
                                            alt={levelInfo.corporationName}
                                            className="w-6 h-6 rounded object-cover flex-shrink-0"
                                            width={24}
                                            height={24}
                                            loading="lazy"
                                            decoding="async"
                                            fetchPriority="low"
                                            onError={(e) => {
                                                const target = e.currentTarget;
                                                // Hide image if it fails to load
                                                target.style.display = 'none';
                                            }}
                                        />
                                        <span>{t("{corporationName} - Level {level}", { corporationName: levelInfo.corporationName, level: levelInfo.level })}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};
