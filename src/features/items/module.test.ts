import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerItemsModule } from './module';

describe('items Uklad module', () => {
    it('owns item filters and parameterized item queries', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerItemsModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            itemsList: [
                { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
                { id: 'iron-plate', name: 'Iron Plate', type: 'product' },
            ],
            buildingsList: [{
                id: 'smelter',
                name: 'Smelter',
                type: 'production',
                recipes: [{
                    output: { id: 'iron-plate', amount_per_minute: 60 },
                    inputs: [{ id: 'iron-ore', amount_per_minute: 60 }],
                }],
            }],
        });

        harness.dispatchSync([appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'raw']);

        expect(harness.getSubscriptionValue([appIds.subscriptions.ITEMS_FILTERED_LIST])).toEqual([
            { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
        ]);
        expect(harness.getSubscriptionValue([
            appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID,
            'smelter',
        ])).toEqual([{ id: 'iron-plate', name: 'Iron Plate', type: 'product' }]);

        runtime.dispose();
    });
});
