import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBasesModule } from '@/features/bases/module';
import { registerBuildingsModule } from '@/features/buildings/module';
import { registerCorporationsModule } from '@/features/corporations/module';
import { registerItemsModule } from '@/features/items/module';
import { registerProductionPlanModalModule } from './module';

describe('production-plan-modal Uklad module', () => {
    it('derives small modal view models from the canonical form root', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        runtime.registerModule(registerCorporationsModule);
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerProductionPlanModalModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            itemsList: [{ id: 'iron-plate', name: 'Iron Plate', type: 'processed' }],
            productionPlanModalState: {
                ...harness.getState().productionPlanModalState,
                isOpen: true,
                editSectionId: 'plan-1',
                name: 'Iron line',
                selectedItemId: 'iron-plate',
                targetAmount: 90,
                matchInputs: true,
            },
        });

        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE])).toEqual({ isOpen: true });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA])).toEqual({ isEditMode: true });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES])).toMatchObject({
            defaultName: 'Iron line',
            selectedItemName: 'Iron Plate',
            currentTargetAmount: 90,
            matchInputs: true,
        });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW])).toEqual({
            nodes: [], edges: [], rawMaterialDeficits: [],
        });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS])).toEqual([]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS])).toEqual([]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA])).toEqual({
            inputItems: [], selectedInputIds: [],
        });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS])).toEqual([]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID])).toBe('iron-plate');
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS])).toEqual([]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY])).toBe(true);

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Renamed line']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, {
            corporationId: 'miners', level: 2,
        }]);
        expect(harness.getState().productionPlanModalState).toMatchObject({
            name: 'Renamed line',
            targetAmount: 90,
            selectedCorporationLevel: { corporationId: 'miners', level: 2 },
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
        expect(harness.getState().productionPlanModalState).toMatchObject({ isOpen: false, name: '' });

        runtime.dispose();
    });

    it('owns the modal workflow from opening through input linking and submit', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerProductionPlanModalModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            basesSelectedBaseId: 'base-1',
            pinnedRecipeSelections: { 'iron-plate': 'smelter:0' },
            buildingsList: [
                { id: 'storage', name: 'Storage', type: 'storage' },
                {
                    id: 'smelter',
                    name: 'Smelter',
                    type: 'production',
                    recipes: [{
                        output: { id: 'iron-plate', amount_per_minute: 60 },
                        inputs: [{ id: 'iron-ore', amount_per_minute: 60 }],
                    }],
                },
            ],
            basesList: [{
                id: 'base-1',
                name: 'Outpost',
                buildings: [
                    {
                        id: 'input-source',
                        buildingTypeId: 'storage',
                        sectionType: 'inputs',
                        selectedItemId: 'iron-ore',
                        ratePerMinute: 60,
                    },
                    {
                        id: 'output-source',
                        buildingTypeId: 'storage',
                        sectionType: 'outputs',
                        selectedItemId: 'iron-ore',
                        ratePerMinute: 30,
                    },
                ],
                productions: [],
            }],
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        expect(harness.getState().productionPlanModalState).toMatchObject({
            isOpen: true,
            baseId: 'base-1',
            targetAmount: 60,
            recipeSelections: { 'iron-plate': 'smelter:0' },
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, 'iron-plate', 'smelter:0']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, 'input-source']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS, {
            'iron-ore': 'extractor:0',
            'iron-plate': 'smelter:0',
        }]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, true]);

        expect(harness.getState().productionPlanModalState).toMatchObject({
            selectedItemId: 'iron-plate',
            targetAmount: 60,
            matchInputs: true,
            selectedInputIds: ['input-source'],
            recipeSelections: { 'iron-plate': 'smelter:0' },
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, ' Iron plan ']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        expect(harness.getState().basesList[0]?.productions).toMatchObject([{
            name: 'Iron plan',
            selectedItemId: 'iron-plate',
            inputs: [{ id: 'input-source' }],
            requiredBuildings: [{ buildingId: 'smelter', count: 1 }],
        }]);

        harness.dispatchSync([
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            'base-1',
            'output-source',
            'storage',
        ]);
        const linkedInput = harness.getState().basesList[0]?.buildings.find((building) =>
            building.linkedOutput?.buildingId === 'output-source'
        );
        expect(linkedInput).toMatchObject({
            sectionType: 'inputs',
            selectedItemId: 'iron-ore',
            ratePerMinute: 30,
            linkedOutput: {
                baseId: 'base-1',
                buildingId: 'output-source',
                itemIdSnapshot: 'iron-ore',
                ratePerMinuteSnapshot: 30,
            },
        });
        expect(harness.getState().productionPlanModalState.selectedInputIds).toContain(linkedInput?.id);

        runtime.dispose();
    });
});
