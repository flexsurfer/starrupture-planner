import { describe, expect, it } from 'vitest';
import type { Base } from '../state/db';
import {
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
});
