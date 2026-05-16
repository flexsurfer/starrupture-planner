import { describe, expect, it } from 'vitest';
import type { Base, BaseBuilding, Building, Production } from '../../../state/db';
import { calculateSharedInputShortages } from './sharedInputShortages';

const TEST_BUILDINGS: Building[] = [
    {
        id: 'smelter',
        name: 'Smelter',
        type: 'production',
        power: 4,
        heat: 2,
        recipes: [
            {
                output: { id: 'bar_iron', amount_per_minute: 60 },
                inputs: [{ id: 'ore_iron', amount_per_minute: 60 }],
            },
        ],
    },
    {
        id: 'ore_excavator',
        name: 'Ore Excavator',
        type: 'input',
        power: 0,
        heat: 0,
        recipes: [],
    },
];

function createInputBuilding(
    id: string,
    itemId: string,
    ratePerMinute: number,
    name?: string
): BaseBuilding {
    return {
        id,
        buildingTypeId: 'ore_excavator',
        sectionType: 'inputs',
        selectedItemId: itemId,
        ratePerMinute,
        name,
    };
}

function createPlan(
    id: string,
    inputBuildings: BaseBuilding[],
    options: { active?: boolean; status?: 'active' | 'inactive' | 'error' } = {}
): Production {
    return {
        id,
        name: `Plan ${id}`,
        selectedItemId: 'bar_iron',
        targetAmount: 60,
        active: options.active ?? false,
        status: options.status || (options.active ? 'active' : 'inactive'),
        inputs: inputBuildings,
        requiredBuildings: [{ buildingId: 'smelter', count: 1 }],
        corporationLevel: null,
    };
}

describe('calculateSharedInputShortages', () => {
    it('detects shortage when an inactive plan shares one input with active plans', () => {
        const sharedInput = createInputBuilding('input_ore_1', 'ore_iron', 60, 'Ore Line 1');
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [sharedInput],
            productions: [
                createPlan('plan_a', [{ ...sharedInput }], { active: true }),
                createPlan('plan_b', [{ ...sharedInput }], { active: false }),
            ],
        };

        const shortages = calculateSharedInputShortages(base, 'plan_b', TEST_BUILDINGS);

        expect(shortages).toEqual([
            {
                baseBuildingId: 'input_ore_1',
                itemId: 'ore_iron',
                requiredPerMinute: 120,
                availablePerMinute: 60,
                missingPerMinute: 60,
            },
        ]);
    });

    it('does not report shortage when plans use different input buildings', () => {
        const inputA = createInputBuilding('input_ore_1', 'ore_iron', 60, 'Ore Line 1');
        const inputB = createInputBuilding('input_ore_2', 'ore_iron', 60, 'Ore Line 2');
        const base: Base = {
            id: 'base_1',
            name: 'Base',
            buildings: [inputA, inputB],
            productions: [
                createPlan('plan_a', [{ ...inputA }], { active: true }),
                createPlan('plan_b', [{ ...inputB }], { active: false }),
            ],
        };

        const shortages = calculateSharedInputShortages(base, 'plan_b', TEST_BUILDINGS);
        expect(shortages).toEqual([]);
    });

    it('aggregates linked output usage across bases', () => {
        const sourceOutput: BaseBuilding = {
            id: 'output_ore_1',
            buildingTypeId: 'ore_excavator',
            sectionType: 'outputs',
            selectedItemId: 'ore_iron',
            ratePerMinute: 60,
        };
        const linkedInputA: BaseBuilding = {
            id: 'input_link_a',
            buildingTypeId: 'ore_excavator',
            sectionType: 'inputs',
            selectedItemId: 'ore_iron',
            ratePerMinute: 60,
            linkedOutput: {
                baseId: 'base_source',
                buildingId: 'output_ore_1',
                itemIdSnapshot: 'ore_iron',
                ratePerMinuteSnapshot: 60,
            },
        };
        const linkedInputB: BaseBuilding = {
            ...linkedInputA,
            id: 'input_link_b',
        };
        const sourceBase: Base = {
            id: 'base_source',
            name: 'Source',
            buildings: [sourceOutput],
            productions: [],
        };
        const activeConsumerBase: Base = {
            id: 'base_a',
            name: 'Consumer A',
            buildings: [linkedInputA],
            productions: [
                createPlan('plan_a', [{ ...linkedInputA }], { active: true }),
            ],
        };
        const currentConsumerBase: Base = {
            id: 'base_b',
            name: 'Consumer B',
            buildings: [linkedInputB],
            productions: [
                createPlan('plan_b', [{ ...linkedInputB }], { active: false }),
            ],
        };

        const shortages = calculateSharedInputShortages(
            currentConsumerBase,
            'plan_b',
            TEST_BUILDINGS,
            [sourceBase, activeConsumerBase, currentConsumerBase]
        );

        expect(shortages).toEqual([
            {
                baseBuildingId: 'input_link_b',
                itemId: 'ore_iron',
                requiredPerMinute: 120,
                availablePerMinute: 60,
                missingPerMinute: 60,
            },
        ]);
    });
});
