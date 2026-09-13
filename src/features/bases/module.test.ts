import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBasesModule } from './module';

describe('bases Uklad module', () => {
    it('shares the details preference across bases and tabs, expanded by default', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        const harness = createUkladTestHarness(runtime);
        const expanded = () => harness.getSubscriptionValue([appIds.subscriptions.BASES_DETAILS_EXPANDED]);

        expect(expanded()).toBe(true);
        harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'First']);
        const firstId = harness.getState().basesSelectedBaseId!;
        harness.dispatchSync([appIds.events.BASES_SET_DETAILS_EXPANDED, false]);
        harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'Second']);
        expect(expanded()).toBe(false);
        harness.dispatchSync([appIds.events.BASES_OPEN_BASE, firstId, 'plans']);
        expect(expanded()).toBe(false);
        harness.dispatchSync([appIds.events.BASES_SET_DETAIL_TAB, 'buildings']);
        expect(expanded()).toBe(false);
        harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, null]);
        harness.dispatchSync([appIds.events.BASES_OPEN_BASE, firstId]);
        expect(expanded()).toBe(false);
        harness.dispatchSync([appIds.events.BASES_SET_DETAILS_EXPANDED, true]);
        expect(expanded()).toBe(true);
        runtime.dispose();
    });

    it('owns base selection, editing, and collapsed-card state', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        const harness = createUkladTestHarness(runtime);

        harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'Outpost One']);
        const [base] = harness.getSubscriptionValue([appIds.subscriptions.BASES_LIST]);

        expect(base).toMatchObject({ name: 'Outpost One', coreLevel: 0, buildings: [], productions: [] });
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_SELECTED_BASE_ID])).toBe(base.id);
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_SELECTED_BASE])).toMatchObject({ id: base.id });
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_BASE_BY_ID, base.id])).toMatchObject({ name: 'Outpost One' });

        harness.dispatchSync([appIds.events.BASES_SET_CORE_LEVEL, 3]);
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDING, base.id, 'smelter', 'production', 'Iron', 'Makes iron']);
        harness.dispatchSync([appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED, base.id, 'productionPlans']);

        expect(harness.getState().basesList[0]?.coreLevel).toBe(3);
        expect(harness.getState().basesList[0]?.buildings).toMatchObject([{
            buildingTypeId: 'smelter', sectionType: 'production', name: 'Iron', description: 'Makes iron',
        }]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS])).toEqual({
            [base.id]: { productionPlans: true },
        });

        runtime.dispose();
    });

    it('owns bulk additions, section count reconciliation, and removal', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            basesSelectedBaseId: 'base-1',
            basesList: [{ id: 'base-1', name: 'Outpost', buildings: [], productions: [] }],
            buildingsList: [{ id: 'smelter', name: 'Smelter', type: 'production' }],
        });

        harness.dispatchSync([
            appIds.events.BASES_ADD_BUILDINGS,
            'base-1',
            'smelter',
            'production',
            2,
            'Iron line',
            'Processes iron',
        ]);
        harness.dispatchSync([
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            'base-1',
            'smelter',
            'production',
            3,
        ]);

        const buildings = harness.getState().basesList[0]?.buildings || [];
        expect(buildings).toHaveLength(3);
        expect(buildings.slice(0, 2)).toMatchObject([
            { buildingTypeId: 'smelter', sectionType: 'production', name: 'Iron line', description: 'Processes iron' },
            { buildingTypeId: 'smelter', sectionType: 'production', name: 'Iron line', description: 'Processes iron' },
        ]);

        harness.dispatchSync([appIds.events.BASES_REMOVE_BUILDING, buildings[1]!.id]);
        expect(harness.getState().basesList[0]?.buildings).toHaveLength(2);

        runtime.dispose();
    });

    it('owns manual input selection plus output and production-plan links', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            basesSelectedBaseId: 'base-1',
            buildingsList: [{ id: 'storage', name: 'Storage', type: 'storage' }],
            basesList: [{
                id: 'base-1',
                name: 'Outpost',
                buildings: [
                    {
                        id: 'input-1',
                        buildingTypeId: 'storage',
                        sectionType: 'inputs',
                        linkedOutput: { baseId: 'other-base', buildingId: 'other-output' },
                        sourceProductionId: 'plan-1',
                        allocationMode: 'fixed',
                        requestedRatePerMinute: 10,
                        capacityPerMinute: 20,
                        priority: 0,
                    },
                    {
                        id: 'output-1',
                        buildingTypeId: 'storage',
                        sectionType: 'outputs',
                        selectedItemId: 'iron-plate',
                        ratePerMinute: 60,
                    },
                ],
                productions: [{
                    id: 'plan-1',
                    name: 'Steel plan',
                    selectedItemId: 'steel-plate',
                    targetAmount: 90,
                }],
            }],
        });

        harness.dispatchSync([
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            'base-1',
            'input-1',
            'iron-plate',
            60,
        ]);
        harness.dispatchSync([
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            'base-1',
            'input-1',
            'base-1',
            'output-1',
        ]);
        harness.dispatchSync([
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            'base-1',
            'output-1',
            {
                sourceProductionId: 'plan-1',
                allocationMode: 'fixed',
                requestedRatePerMinute: 30,
                capacityPerMinute: 40,
                priority: 2,
            },
        ]);

        const [input, output] = harness.getState().basesList[0]!.buildings;
        expect(input).toMatchObject({
            selectedItemId: 'iron-plate',
            ratePerMinute: 60,
            linkedOutput: {
                baseId: 'base-1',
                buildingId: 'output-1',
                itemIdSnapshot: 'iron-plate',
                ratePerMinuteSnapshot: 60,
            },
        });
        expect(output).toMatchObject({
            sourceProductionId: 'plan-1',
            allocationMode: 'fixed',
            requestedRatePerMinute: 30,
            capacityPerMinute: 40,
            priority: 2,
            selectedItemId: 'steel-plate',
        });

        harness.dispatchSync([
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            'base-1',
            'output-1',
            { sourceProductionId: null },
        ]);
        expect(harness.getState().basesList[0]?.buildings[1]).not.toMatchObject({
            sourceProductionId: expect.anything(),
            allocationMode: expect.anything(),
        });

        runtime.dispose();
    });
});
