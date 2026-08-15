import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from './register';

describe('headless MCP workflow', () => {
    const runtimes: ReturnType<typeof createAppRuntime>[] = [];

    afterEach(() => {
        runtimes.splice(0).forEach((runtime) => runtime.dispose());
    });

    it('creates a base, saves a production plan, and adds its required buildings', async () => {
        const runtime = createAppRuntime({ runtimeId: 'headless-e2e-test' });
        runtimes.push(runtime);
        registerHeadlessApplication(runtime);
        const harness = createUkladTestHarness(runtime);

        harness.dispatchSync([appIds.events.APP_INIT]);
        await vi.waitFor(() => {
            expect(harness.getState().uiGameDataLoadPending).toBe(false);
            expect(harness.getState().buildingsList.length).toBeGreaterThan(0);
        });

        const smelter = harness.getState().buildingsList.find((building) => building.id === 'smelter');
        expect(smelter?.recipes?.[0]).toBeDefined();

        const recipe = smelter!.recipes![0]!;
        const inputItemId = recipe.inputs[0]?.id;
        const extractor = harness.getState().buildingsList.find((building) =>
            building.id === 'ore_excavator' && building.recipes?.some((candidate) =>
                candidate.output.id === inputItemId
            )
        );
        expect(extractor).toBeDefined();

        harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'MCP Test Base']);
        const baseId = harness.getState().basesSelectedBaseId;
        expect(baseId).toBeTruthy();

        harness.dispatchSync([appIds.events.BASES_ADD_BUILDING, baseId!, extractor!.id, 'inputs']);
        const inputBuilding = harness.getState().basesList[0]?.buildings[0];
        expect(inputBuilding).toMatchObject({ buildingTypeId: extractor!.id, sectionType: 'inputs' });

        harness.dispatchSync([
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            baseId!,
            inputBuilding!.id,
            inputItemId!,
            recipe.inputs[0]!.amount_per_minute,
        ]);

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Titanium bars']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, recipe.output.id]);
        harness.dispatchSync([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            recipe.output.id,
            `${smelter!.id}:0`,
        ]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputBuilding!.id]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);

        const base = harness.getState().basesList[0];
        const plan = base?.productions[0];
        expect(plan).toMatchObject({
            name: 'Titanium bars',
            selectedItemId: recipe.output.id,
            requiredBuildings: [{ buildingId: smelter!.id, count: 1 }],
            inputs: [{ id: inputBuilding!.id, selectedItemId: inputItemId }],
        });

        harness.dispatchSync([
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId!,
            plan!.id,
            'all',
        ]);

        expect(harness.getState().basesList[0]?.buildings.map((building) => building.buildingTypeId))
            .toEqual([extractor!.id, smelter!.id]);
        expect(harness.getSubscriptionValue([
            appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID,
            baseId!,
            plan!.id,
        ])).toMatchObject({
            itemName: harness.getState().itemsById[recipe.output.id]?.name,
            buildingRequirements: [{ buildingId: smelter!.id, required: 1 }],
        });
    });
});
