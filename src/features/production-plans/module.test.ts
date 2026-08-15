import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBasesModule } from '@/features/bases/module';
import { registerItemsModule } from '@/features/items/module';
import { registerProductionPlansModule } from './module';

describe('production-plans Uklad module', () => {
    it('activates, deactivates, and deletes a plan section', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerProductionPlansModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            itemsById: { 'iron-plate': { id: 'iron-plate', name: 'Iron Plate', type: 'processed' } },
            basesSelectedBaseId: 'base-1',
            basesList: [{
                id: 'base-1',
                name: 'Outpost',
                buildings: [],
                productions: [{
                    id: 'plan-1',
                    name: 'Iron Plates',
                    selectedItemId: 'iron-plate',
                    targetAmount: 60,
                    active: false,
                    status: 'inactive',
                }],
            }],
        });

        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS])).toEqual(['plan-1']);
        expect(harness.getSubscriptionValue([
            appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID,
            'base-1',
            'plan-1',
        ])).toMatchObject({ name: 'Iron Plates' });
        expect(harness.getSubscriptionValue([
            appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID,
            'iron-plate',
        ])).toBe('Iron Plate');

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, 'base-1', 'plan-1']);
        expect(harness.getState().basesList[0]?.productions[0]).toMatchObject({ active: true, status: 'active' });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, 'base-1', 'plan-1']);
        expect(harness.getState().basesList[0]?.productions[0]).toMatchObject({ active: false, status: 'inactive' });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_DELETE_SECTION, 'base-1', 'plan-1']);
        expect(harness.getState().basesList[0]?.productions).toEqual([]);

        runtime.dispose();
    });

    it('adds all required buildings or only the missing ones for a plan', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        runtime.registerModule(registerProductionPlansModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            buildingsList: [{
                id: 'smelter',
                name: 'Smelter',
                type: 'production',
                recipes: [{
                    output: { id: 'iron-plate', amount_per_minute: 60 },
                    inputs: [{ id: 'iron-ore', amount_per_minute: 60 }],
                }],
            }],
            basesList: [{
                id: 'base-1',
                name: 'Outpost',
                buildings: [],
                productions: [{
                    id: 'plan-1',
                    name: 'Iron plates',
                    selectedItemId: 'iron-plate',
                    targetAmount: 60,
                    active: false,
                    status: 'inactive',
                }],
            }],
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, 'base-1', 'plan-1', 'all']);
        expect(harness.getState().basesList[0]?.buildings).toMatchObject([
            { buildingTypeId: 'smelter', sectionType: 'production' },
        ]);

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, 'base-1', 'plan-1', 'missing']);
        expect(harness.getState().basesList[0]?.buildings).toHaveLength(1);

        runtime.dispose();
    });
});
