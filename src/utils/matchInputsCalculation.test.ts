import { describe, it, expect } from 'vitest';
import { calculateMaxTargetFromInputs } from './matchInputsCalculation';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import type { BaseBuilding, Building } from '../state/db';

/*
 * Recipe chain used by most tests (mirrors productionFlowBuilder.test.ts):
 *
 *   ore_excavator:  → ore_titanium      75/min  (raw, no inputs)
 *   smelter:        ore_titanium 90/min  → bar_titanium      60/min
 *   fabricator[0]:  bar_titanium 60/min  → titanium_beam     30/min
 *   fabricator[1]:  bar_titanium 30/min  → titanium_sheet    60/min
 *   furnace:        titanium_beam 30 + titanium_sheet 60  → titanium_housing  30/min
 *
 * Per titanium_housing:
 *   bar_titanium  = 60 (beam) + 30 (sheet)  = 90  → ratio 3 bar per housing
 *   ore_titanium  = 90 * 1.5                = 135  → ratio 4.5 ore per housing
 */

const buildings: Building[] = [
    {
        id: 'ore_excavator',
        name: 'Ore Excavator',
        power: 10,
        heat: 10,
        recipes: [
            { output: { id: 'ore_titanium', amount_per_minute: 75 }, inputs: [] },
        ],
    },
    {
        id: 'smelter',
        name: 'Smelter',
        power: 10,
        heat: 10,
        recipes: [
            {
                output: { id: 'bar_titanium', amount_per_minute: 60 },
                inputs: [{ id: 'ore_titanium', amount_per_minute: 90 }],
            },
        ],
    },
    {
        id: 'fabricator',
        name: 'Fabricator',
        power: 10,
        heat: 10,
        recipes: [
            {
                output: { id: 'titanium_beam', amount_per_minute: 30 },
                inputs: [{ id: 'bar_titanium', amount_per_minute: 60 }],
            },
            {
                output: { id: 'titanium_sheet', amount_per_minute: 60 },
                inputs: [{ id: 'bar_titanium', amount_per_minute: 30 }],
            },
        ],
    },
    {
        id: 'furnace',
        name: 'Furnace',
        power: 10,
        heat: 10,
        recipes: [
            {
                output: { id: 'titanium_housing', amount_per_minute: 30 },
                inputs: [
                    { id: 'titanium_beam', amount_per_minute: 30 },
                    { id: 'titanium_sheet', amount_per_minute: 60 },
                ],
            },
        ],
    },
    {
        id: 'orbital_cargo_launcher',
        name: 'Orbital Cargo Launcher',
        power: 10,
        heat: 5,
        recipes: [],
    },
];

function makeInput(id: string, itemId: string, rate: number): BaseBuilding {
    return {
        id,
        buildingTypeId: 'importer',
        sectionType: 'inputs',
        selectedItemId: itemId,
        ratePerMinute: rate,
    };
}

function verifyNoDeficitsAtResult(
    result: number,
    selectedItemId: string,
    inputBuildings: BaseBuilding[],
) {
    const flow = buildProductionFlow(
        { targetItemId: selectedItemId, targetAmount: result, inputBuildings, rawProductionDisabled: true, includeLauncher: false },
        buildings,
    );
    const relevantDeficits = (flow.rawMaterialDeficits || []).filter(d => d.available > 0 && d.missing > 0.0001);
    expect(relevantDeficits).toHaveLength(0);
}

describe('calculateMaxTargetFromInputs', () => {
    describe('returns null for invalid / empty inputs', () => {
        it('returns null when no item is selected', () => {
            expect(calculateMaxTargetFromInputs({
                selectedItemId: '',
                inputBuildings: [makeInput('i1', 'ore_titanium', 90)],
                buildings,
                includeLauncher: false,
            })).toBeNull();
        });

        it('returns null when input buildings array is empty', () => {
            expect(calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: [],
                buildings,
                includeLauncher: false,
            })).toBeNull();
        });

        it('returns null when inputs do not match any recipe material', () => {
            expect(calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: [makeInput('i1', 'nonexistent_item', 100)],
                buildings,
                includeLauncher: false,
            })).toBeNull();
        });

        it('returns null when the only input provides the target item itself', () => {
            expect(calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: [makeInput('i1', 'bar_titanium', 60)],
                buildings,
                includeLauncher: false,
            })).toBeNull();
        });
    });

    describe('single raw-material input', () => {
        it('calculates max for exact capacity match', () => {
            // 30 housing needs 135 ore_titanium (4.5 per housing)
            const inputs = [makeInput('i1', 'ore_titanium', 135)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(30);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('calculates max for double capacity', () => {
            const inputs = [makeInput('i1', 'ore_titanium', 270)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(60);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('calculates max for a simpler chain (bar_titanium target)', () => {
            // bar_titanium: 60/min needs 90 ore_titanium → ratio 1.5 ore per bar
            const inputs = [makeInput('i1', 'ore_titanium', 90)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(60);
            verifyNoDeficitsAtResult(result!, 'bar_titanium', inputs);
        });

        it('scales proportionally for partial capacity', () => {
            // 75 ore → 75 / 1.5 = 50 bar_titanium
            const inputs = [makeInput('i1', 'ore_titanium', 75)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(50);
            verifyNoDeficitsAtResult(result!, 'bar_titanium', inputs);
        });
    });

    describe('multiple inputs for the same material', () => {
        it('sums capacity from multiple inputs', () => {
            // Two ore inputs: 45 + 45 = 90 → 60 bar_titanium
            const inputs = [
                makeInput('i1', 'ore_titanium', 45),
                makeInput('i2', 'ore_titanium', 45),
            ];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(60);
            verifyNoDeficitsAtResult(result!, 'bar_titanium', inputs);
        });
    });

    describe('intermediate inputs', () => {
        it('uses intermediate input to skip production steps', () => {
            // Provide bar_titanium directly — skips smelter + ore stages
            // 90 bar needed for 30 housing → max = 30
            const inputs = [makeInput('i1', 'bar_titanium', 90)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(30);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('handles partial intermediate input', () => {
            // 45 bar / 3 bar per housing = 15 housing
            const inputs = [makeInput('i1', 'bar_titanium', 45)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(15);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('handles intermediate inputs covering entire branches', () => {
            // Provide both beam and sheet directly → no production needed
            const inputs = [
                makeInput('i1', 'titanium_beam', 30),
                makeInput('i2', 'titanium_sheet', 60),
            ];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(30);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('bottleneck is the lesser intermediate input', () => {
            // beam at 15 limits to 15 housing even though sheet allows 30
            const inputs = [
                makeInput('i1', 'titanium_beam', 15),
                makeInput('i2', 'titanium_sheet', 60),
            ];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBe(15);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });
    });

    describe('mixed raw + intermediate inputs', () => {
        it('combines intermediate and raw inputs across chain levels', () => {
            // bar at 45 covers 15 housing worth of bars.
            // Beyond 15 housing, need to produce bars → need ore.
            // Extra bars needed per housing beyond 15: 3 per housing
            // Extra ore per extra bar: 1.5 → extra ore per housing beyond 15: 4.5
            // ore at 100 → extra housing = 100 / 4.5 ≈ 22.22
            // total ≈ 15 + 22.22 = 37.22
            const inputs = [
                makeInput('i1', 'bar_titanium', 45),
                makeInput('i2', 'ore_titanium', 100),
            ];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).toBeCloseTo(37.22, 1);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('intermediate fully covers its branch, raw covers remaining', () => {
            // bar at 90 covers all 30 housing bar demand → no ore needed
            // ore at 100 → unused by production
            // max = 30 (limited by bar)
            const inputs = [
                makeInput('i1', 'bar_titanium', 90),
                makeInput('i2', 'ore_titanium', 100),
            ];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });

            // bar limits to 30 housing; beyond that bar excess → ore kicks in
            // bar at 90 covers 30 housing. Beyond 30: extra bars = 3*(T-30), ore = 4.5*(T-30)
            // ore at 100 → 100/4.5 ≈ 22.22 extra → total ≈ 52.22
            expect(result).toBeCloseTo(52.22, 1);
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });
    });

    describe('result does not overshoot (P3 rounding safety)', () => {
        it('rounded result does not introduce deficits', () => {
            const inputs = [makeInput('i1', 'ore_titanium', 135)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).not.toBeNull();
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });

        it('does not overshoot for non-round capacities', () => {
            // 100 ore / 1.5 = 66.666... bar → result should not exceed 66.66
            const inputs = [makeInput('i1', 'ore_titanium', 100)];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).not.toBeNull();
            expect(result!).toBeLessThanOrEqual(66.67);
            verifyNoDeficitsAtResult(result!, 'bar_titanium', inputs);
        });

        it('does not overshoot for tricky intermediate fractions', () => {
            const inputs = [
                makeInput('i1', 'bar_titanium', 45),
                makeInput('i2', 'ore_titanium', 100),
            ];
            const result = calculateMaxTargetFromInputs({
                selectedItemId: 'titanium_housing',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            expect(result).not.toBeNull();
            verifyNoDeficitsAtResult(result!, 'titanium_housing', inputs);
        });
    });

    describe('launcher flag', () => {
        it('returns the same max regardless of launcher flag', () => {
            const inputs = [makeInput('i1', 'ore_titanium', 90)];
            const withoutLauncher = calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: inputs,
                buildings,
                includeLauncher: false,
            });
            const withLauncher = calculateMaxTargetFromInputs({
                selectedItemId: 'bar_titanium',
                inputBuildings: inputs,
                buildings,
                includeLauncher: true,
            });
            expect(withoutLauncher).toBe(withLauncher);
        });
    });
});
