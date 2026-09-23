import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import type { Building } from './types';

const buildings: Building[] = [{ id: 'factory', name: 'Factory', type: 'production', power: 10, recipes: [
    { output: { id: 'ore', amount_per_minute: 60 }, inputs: [] },
    { output: { id: 'plate', amount_per_minute: 20 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] },
    { output: { id: 'product', amount_per_minute: 10 }, inputs: [{ id: 'plate', amount_per_minute: 20 }] },
    { output: { id: 'other', amount_per_minute: 10 }, inputs: [{ id: 'plate', amount_per_minute: 10 }] },
] }];

describe('planner external resources', () => {
    it.each(['single', 'multi'] as const)('replaces upstream production, covers partial supply, and reverts in a %s tab', mode => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerApplicationModules);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({ ...harness.getState(), buildingsList: buildings,
            itemsList: ['ore', 'plate', 'product', 'other'].map(id => ({ id, name: id, type: id === 'ore' ? 'raw' : 'processed' })) });
        try {
            harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'product']);
            harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Plan', mode]);
            if (mode === 'multi') harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'other']);
            const flow = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]);
            const before = flow();
            const demand = mode === 'multi' ? 30 : 20;
            harness.dispatchSync([appIds.events.PLANNER_SET_EXTERNAL_INPUT, 'plate', 10]);
            const input = flow().nodes.find(node => node.nodeType === 'input');
            expect(input).toMatchObject({ outputItem: 'plate', outputAmount: 10, buildingCount: 1 });
            const producer = flow().nodes.find(node => node.nodeType === 'production' && node.outputItem === 'plate');
            expect(producer).toMatchObject({ buildingCount: (demand - 10) / 20 });
            expect(flow().edges.filter(edge => edge.itemId === 'plate').reduce((sum, edge) => sum + edge.amount, 0)).toBe(demand);

            harness.dispatchSync([appIds.events.PLANNER_SET_EXTERNAL_INPUT, 'plate', demand * 2]);
            expect(flow().nodes.some(node => node.outputItem === 'ore')).toBe(false);
            expect(flow().nodes.filter(node => node.outputItem === 'plate')).toEqual([
                expect.objectContaining({ nodeType: 'input', outputAmount: demand * 2, buildingCount: 0.5 }),
            ]);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_SUMMARY]).totalBuildings).toBe(mode === 'multi' ? 2 : 1);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]).buildingStats).toEqual([
                expect.objectContaining({ buildingId: 'factory', count: mode === 'multi' ? 2 : 1 }),
            ]);

            // Invalid rates and attempts to replace the final output leave the plan intact.
            for (const amount of [0, -1, NaN, Infinity]) harness.dispatchSync([appIds.events.PLANNER_SET_EXTERNAL_INPUT, 'plate', amount]);
            harness.dispatchSync([appIds.events.PLANNER_SET_EXTERNAL_INPUT, 'product', 20]);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ plate: demand * 2 });
            harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'other-tab', 'Other tab', 'single']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({});
            harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'plan']);
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_EXTERNAL_INPUT, 'plate']);
            expect(flow()).toEqual(before);
        } finally { runtime.dispose(); }
    });
});
