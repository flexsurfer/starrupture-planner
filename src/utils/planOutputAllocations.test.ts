import { describe, expect, it } from 'vitest';
import type { Base } from '../state/db';
import {
    clearOutputPlanLinksForProduction,
    getPlanOutputAllocationSummary,
    resolveOutputBuilding,
} from './planOutputAllocations';

function createBase(targetAmount = 450): Base {
    return {
        id: 'base_source',
        name: 'Source',
        buildings: [
            {
                id: 'dispatcher_1',
                buildingTypeId: 'package_dispatcher',
                sectionType: 'outputs',
                sourceProductionId: 'plan_rods',
                allocationMode: 'auto',
                priority: 1,
            },
            {
                id: 'dispatcher_2',
                buildingTypeId: 'package_dispatcher',
                sectionType: 'outputs',
                sourceProductionId: 'plan_rods',
                allocationMode: 'auto',
                priority: 2,
            },
            {
                id: 'dispatcher_3',
                buildingTypeId: 'package_dispatcher',
                sectionType: 'outputs',
                sourceProductionId: 'plan_rods',
                allocationMode: 'auto',
                priority: 3,
            },
        ],
        productions: [
            {
                id: 'plan_rods',
                name: 'Rods',
                selectedItemId: 'titanium_rod',
                targetAmount,
            },
        ],
    };
}

describe('plan output allocations', () => {
    it('fills linked dispatchers by priority up to capacity', () => {
        const base = createBase(450);
        const summary = getPlanOutputAllocationSummary(base, 'plan_rods');

        expect(summary?.producedRatePerMinute).toBe(450);
        expect(summary?.assignedRatePerMinute).toBe(450);
        expect(summary?.remainingRatePerMinute).toBe(0);
        expect(summary?.outputs.map((output) => output.ratePerMinute)).toEqual([200, 200, 50]);
    });

    it('cascades source target changes without mutating outputs', () => {
        const base = createBase(300);
        const summary = getPlanOutputAllocationSummary(base, 'plan_rods');

        expect(summary?.outputs.map((output) => output.ratePerMinute)).toEqual([200, 100, 0]);
        expect(base.buildings.map((output) => output.ratePerMinute)).toEqual([undefined, undefined, undefined]);
    });

    it('allows capacity overrides for virtual dispatchers', () => {
        const base = createBase(600);
        base.buildings[0].capacityPerMinute = 800;

        const resolved = resolveOutputBuilding(base.buildings[0], base);

        expect(resolved.ratePerMinute).toBe(600);
        expect(resolved.capacityPerMinuteResolved).toBe(800);
    });

    it('keeps manual outputs unchanged when they are not plan-linked', () => {
        const base = createBase(450);
        const manual = {
            id: 'manual_output',
            buildingTypeId: 'package_dispatcher',
            sectionType: 'outputs',
            selectedItemId: 'electronics',
            ratePerMinute: 120,
        };

        const resolved = resolveOutputBuilding(manual, base);

        expect(resolved.outputResolutionStatus).toBe('manual');
        expect(resolved.selectedItemId).toBe('electronics');
        expect(resolved.ratePerMinute).toBe(120);
    });

    it('clears stale output links when a source production is removed', () => {
        const base = createBase(450);
        base.buildings[0].selectedItemId = 'titanium_rod';
        base.buildings.push({
            id: 'other_plan_output',
            buildingTypeId: 'package_dispatcher',
            sectionType: 'outputs',
            sourceProductionId: 'other_plan',
            allocationMode: 'auto',
            capacityPerMinute: 200,
            priority: 1,
        });

        const clearedCount = clearOutputPlanLinksForProduction(base, 'plan_rods');

        expect(clearedCount).toBe(3);
        expect(base.buildings.slice(0, 3)).toEqual([
            expect.objectContaining({
                id: 'dispatcher_1',
                selectedItemId: 'titanium_rod',
                sourceProductionId: undefined,
                allocationMode: undefined,
                capacityPerMinute: undefined,
                priority: undefined,
            }),
            expect.objectContaining({
                id: 'dispatcher_2',
                sourceProductionId: undefined,
                allocationMode: undefined,
                capacityPerMinute: undefined,
                priority: undefined,
            }),
            expect.objectContaining({
                id: 'dispatcher_3',
                sourceProductionId: undefined,
                allocationMode: undefined,
                capacityPerMinute: undefined,
                priority: undefined,
            }),
        ]);
        expect(base.buildings[3]).toMatchObject({
            id: 'other_plan_output',
            sourceProductionId: 'other_plan',
            allocationMode: 'auto',
            capacityPerMinute: 200,
            priority: 1,
        });
    });
});
