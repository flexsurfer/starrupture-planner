import type { InputBuildingSnapshot } from './types';

export const EXTERNAL_RESOURCE_BUILDING_ID = 'external-resource';

export function getPlannerInputBuildings(inputs: Record<string, number>): InputBuildingSnapshot[] {
    return Object.entries(inputs).map(([itemId, amount]) => ({
        id: `planner-input:${itemId}`,
        buildingTypeId: EXTERNAL_RESOURCE_BUILDING_ID,
        sectionType: 'inputs',
        selectedItemId: itemId,
        ratePerMinute: amount,
    }));
}
