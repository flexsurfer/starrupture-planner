import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import type { Corporation } from '../../state/db';
import { CorporationUsageBadge } from '../items';

interface SelectedCorporationLevel {
    corporationId: string;
    level: number;
}

interface LauncherStatsPanelProps {
    /** Total power consumption from the flow calculation */
    totalPowerConsumption: number;
    /** Selected item ID to find the component data */
    itemId: string;
    /** Number of launcher buildings */
    buildingCount: number;
}

/**
 * Component that displays the launcher stats panel including:
 * - Corporation badge
 * - Level Cost (XP required for the level)
 * - Launch Time (items needed / 10 items per minute)
 * - Total Power consumption
 */
export const LauncherStatsPanel = ({ totalPowerConsumption, itemId, buildingCount }: LauncherStatsPanelProps) => {
    const selectedLevel = useSubscription<SelectedCorporationLevel | null>([SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL]);
    const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);

    if (!selectedLevel) {
        return null;
    }

    // Find the corporation and level data
    const corporation = corporations.find(c => c.id === selectedLevel.corporationId);
    if (!corporation) {
        return null;
    }

    const corporationName = corporation.name;
    const levelData = corporation.levels.find(l => l.level === selectedLevel.level);
    if (!levelData) {
        return null;
    }

    // Find the component data for the selected item
    const componentData = levelData.components.find(c => c.id === itemId);
    if (!componentData) {
        return null;
    }

    // Level Cost = XP required for this level
    const levelCost = levelData.xp ?? 0;

    // Items needed = cost from component (number of items to complete level with this item)
    const itemsNeeded = componentData.cost ?? 0;

    // Launch Time = items needed / (10 items per minute * number of launchers)
    const launchTime = itemsNeeded / (10 * buildingCount);

    return (
        <div className="text-xs space-y-1">
            <div className="mt-1">
                <CorporationUsageBadge
                    usage={{
                        corporation: corporationName,
                        level: selectedLevel.level
                    }}
                    corporationId={selectedLevel.corporationId}
                />
            </div>
            <div className="text-green-500 font-semibold">
                Level Cost: {levelCost} XP
            </div>
            <div className="text-purple-500 font-semibold">
                Items Needed: {itemsNeeded}
            </div>
            <div className="text-yellow-500 font-semibold">
                Total Launch Time: {launchTime.toFixed(1)} min
            </div>
            <div className="text-blue-500 font-semibold border-t border-base-300 pt-1 mt-2">
                Total ⚡: {Math.ceil(totalPowerConsumption)}
            </div>
        </div>
    );
};
