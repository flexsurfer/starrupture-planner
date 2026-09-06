import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBuildingsModule } from '@/features/buildings/module';
import { registerItemsModule } from '@/features/items/module';
import { registerPlannerModule } from './module';

describe('planner Uklad module', () => {
    it('totals shared ingredient demand and scales item rates with the target', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerPlannerModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            itemsList: [
                { id: 'ore', name: 'Ore', type: 'raw' },
                { id: 'plate', name: 'Plate', type: 'processed' },
                { id: 'product', name: 'Product', type: 'component' },
            ],
            buildingsList: [{
                id: 'factory', name: 'Factory',
                recipes: [
                    { output: { id: 'ore', amount_per_minute: 60 }, inputs: [] },
                    { output: { id: 'plate', amount_per_minute: 20 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] },
                    { output: { id: 'product', amount_per_minute: 10 }, inputs: [
                        { id: 'plate', amount_per_minute: 20 },
                        { id: 'ore', amount_per_minute: 5 },
                    ] },
                ],
            }],
        });
        try {
            harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'product']);
            const rates = () => Object.fromEntries(
                [...harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]).itemsByType.values()]
                    .flat().map(item => [item.id, item.requiredRate]),
            );
            expect(rates()).toEqual({ ore: 35, plate: 20, product: 10 });
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED])
                .productionGroups.map(group => ({ type: group.type, items: group.nodes.map(node => node.outputItem) })))
                .toEqual([
                    { type: 'target', items: ['product'] },
                    { type: 'raw', items: ['ore'] },
                    { type: 'processed', items: ['plate'] },
                ]);
            harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 25]);
            expect(rates()).toEqual({ ore: 87.5, plate: 50, product: 25 });
        } finally {
            runtime.dispose();
        }
    });

    it('sets planner state and its default target rate through typed events', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerPlannerModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            itemsList: [
                { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
                { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
            ],
            buildingsList: [{
                id: 'assembler',
                name: 'Assembler',
                recipes: [{
                    output: { id: 'iron-plate', amount_per_minute: 45 },
                    inputs: [],
                }],
            }],
        });

        harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'iron-plate']);

        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_SELECTED_ITEM_ID])).toBe('iron-plate');
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TARGET_AMOUNT])).toBe(45);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_SELECTABLE_ITEMS])).toEqual([
            { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
        ]);
        expect(harness.getState().uiActiveTab).toBe('planner');

        runtime.dispose();
    });
});
