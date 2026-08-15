import { createUkladRuntime } from '@ukladjs/core/vanilla';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { initialAppState } from './db';
import { SUB_IDS } from './sub-ids';
import { registerSubscriptions } from './subs';

describe('direct Uklad subscriptions', () => {
    it('preserves derived values and query parameters after the direct cutover', () => {
        const runtime = createUkladRuntime({
            initialState: {
                ...initialAppState,
                itemsList: [
                    { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
                    { id: 'iron-plate', name: 'Iron Plate', type: 'product' },
                ],
                itemsSelectedCategory: 'raw',
                buildingsList: [{
                    id: 'smelter',
                    name: 'Smelter',
                    type: 'production',
                    recipes: [{
                        output: { id: 'iron-plate', amount_per_minute: 60 },
                        inputs: [{ id: 'iron-ore', amount_per_minute: 60 }],
                    }],
                }],
            },
        });
        runtime.registerModule(registerSubscriptions);
        const harness = createUkladTestHarness(runtime);

        expect(harness.getSubscriptionValue([SUB_IDS.ITEMS_FILTERED_LIST])).toEqual([
            { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
        ]);
        expect(harness.getSubscriptionValue([
            SUB_IDS.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID,
            'smelter',
        ])).toEqual([{ id: 'iron-plate', name: 'Iron Plate', type: 'product' }]);

        runtime.dispose();
    });
});
