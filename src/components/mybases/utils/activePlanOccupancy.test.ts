import { describe, expect, it } from 'vitest';
import type { Base, BaseBuilding, Production } from '../../../state/db';
import { buildActivePlanOccupancy } from './activePlanOccupancy';

function createBaseBuilding(
    id: string,
    buildingTypeId: string,
    sectionType: string,
    selectedItemId?: string
): BaseBuilding {
    return {
        id,
        buildingTypeId,
        sectionType,
        selectedItemId,
        ratePerMinute: selectedItemId ? 60 : undefined,
    };
}

function createPlan(partial: Partial<Production> & { id: string; name: string }): Production {
    return {
        id: partial.id,
        name: partial.name,
        selectedItemId: partial.selectedItemId || 'target_item',
        targetAmount: partial.targetAmount || 60,
        active: partial.active ?? false,
        inputs: partial.inputs || [],
        requiredBuildings: partial.requiredBuildings || [],
        status: partial.status || 'inactive',
        corporationLevel: partial.corporationLevel || null,
    };
}

describe('buildActivePlanOccupancy', () => {
    it('assigns free buildings first and overlaps only when required', () => {
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [
                createBaseBuilding('s1', 'smelter', 'production'),
                createBaseBuilding('s2', 'smelter', 'production'),
                createBaseBuilding('s3', 'smelter', 'production'),
            ],
            productions: [
                createPlan({
                    id: 'plan_a',
                    name: 'Plan A',
                    active: true,
                    requiredBuildings: [{ buildingId: 'smelter', count: 2 }],
                    status: 'active',
                }),
                createPlan({
                    id: 'plan_b',
                    name: 'Plan B',
                    active: true,
                    requiredBuildings: [{ buildingId: 'smelter', count: 2 }],
                    status: 'active',
                }),
            ],
        };

        const occupancy = buildActivePlanOccupancy(base);
        const planABuildings = occupancy.assignedPlanBuildingIds.get('plan_a');
        const planBBuildings = occupancy.assignedPlanBuildingIds.get('plan_b');

        expect(planABuildings).toBeDefined();
        expect(planBBuildings).toBeDefined();
        expect(planABuildings ? Array.from(planABuildings) : []).toEqual(['s1', 's2']);
        expect(planBBuildings ? Array.from(planBBuildings) : []).toEqual(['s3', 's1']);
        expect(occupancy.occupiedBuildingTypeCounts.get('smelter')).toBe(3);
    });

    it('prioritizes buildings with selected items when allocating requirements', () => {
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [
                createBaseBuilding('b_without_item', 'assembler', 'production'),
                createBaseBuilding('b_with_item', 'assembler', 'production', 'bar_steel'),
            ],
            productions: [
                createPlan({
                    id: 'plan_1',
                    name: 'Plan 1',
                    active: true,
                    requiredBuildings: [{ buildingId: 'assembler', count: 1 }],
                    status: 'active',
                }),
            ],
        };

        const occupancy = buildActivePlanOccupancy(base);
        expect(Array.from(occupancy.assignedPlanBuildingIds.get('plan_1') || [])).toEqual(['b_with_item']);
    });

    it('does not reserve explicit input buildings for occupancy counts', () => {
        const input1 = createBaseBuilding('input_1', 'ore_excavator', 'inputs', 'ore_iron');
        const input2 = createBaseBuilding('input_2', 'ore_excavator', 'inputs', 'ore_copper');
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [input1, input2],
            productions: [
                createPlan({
                    id: 'plan_inputs',
                    name: 'Plan Inputs',
                    active: true,
                    inputs: [{ ...input1 }],
                    status: 'active',
                }),
                createPlan({
                    id: 'plan_required',
                    name: 'Plan Required',
                    active: true,
                    requiredBuildings: [{ buildingId: 'ore_excavator', count: 2 }],
                    status: 'active',
                }),
            ],
        };

        const occupancy = buildActivePlanOccupancy(base);
        expect(Array.from(occupancy.assignedPlanBuildingIds.get('plan_inputs') || [])).toEqual([]);
        expect(Array.from(occupancy.assignedPlanBuildingIds.get('plan_required') || [])).toEqual(['input_1', 'input_2']);
    });

    it('overlaps production assignments when free buildings are exhausted', () => {
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [createBaseBuilding('s1', 'smelter', 'production')],
            productions: [
                createPlan({
                    id: 'plan_a',
                    name: 'Plan A',
                    active: true,
                    requiredBuildings: [{ buildingId: 'smelter', count: 1 }],
                    status: 'active',
                }),
                createPlan({
                    id: 'plan_b',
                    name: 'Plan B',
                    active: true,
                    requiredBuildings: [{ buildingId: 'smelter', count: 1 }],
                    status: 'active',
                }),
            ],
        };

        const occupancy = buildActivePlanOccupancy(base);
        expect(Array.from(occupancy.assignedPlanBuildingIds.get('plan_a') || [])).toEqual(['s1']);
        expect(Array.from(occupancy.assignedPlanBuildingIds.get('plan_b') || [])).toEqual(['s1']);
        expect(occupancy.occupiedBuildingTypeCounts.get('smelter')).toBe(1);
    });

    it('can exclude the current plan from occupancy calculations', () => {
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [
                createBaseBuilding('s1', 'smelter', 'production'),
                createBaseBuilding('s2', 'smelter', 'production'),
            ],
            productions: [
                createPlan({
                    id: 'plan_a',
                    name: 'Plan A',
                    active: true,
                    requiredBuildings: [{ buildingId: 'smelter', count: 1 }],
                    status: 'active',
                }),
                createPlan({
                    id: 'plan_b',
                    name: 'Plan B',
                    active: true,
                    requiredBuildings: [{ buildingId: 'smelter', count: 1 }],
                    status: 'active',
                }),
            ],
        };

        const occupancy = buildActivePlanOccupancy(base, { excludePlanId: 'plan_b' });
        expect(Array.from(occupancy.assignedPlanBuildingIds.keys())).toEqual(['plan_a']);
        expect(occupancy.occupiedBuildingTypeCounts.get('smelter')).toBe(1);
    });
});
