// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import {
    createHeadlessE2EApp,
    type HeadlessE2EApp,
} from './e2e-support';

describe('headless production planning E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = () => {
        const app = createHeadlessE2EApp();
        apps.push(app);
        return app;
    };

    afterEach(async () => {
        await Promise.all(apps.splice(0).map((app) => app.dispose()));
    });

    it('emulates every closed, empty, invalid, and missing plan view', async () => {
        const app = createApp();
        await app.seed();
        const modal = app.mountView('empty production modal', {
            state: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE],
            open: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE],
            header: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA],
            form: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW],
            options: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS],
            levels: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS],
            inputs: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA],
            outputs: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS],
            selectedItem: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID],
            deficits: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS],
            valid: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY],
        } as const);
        const missing = app.mountView('missing production section', {
            ids: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS],
            entity: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, 'missing-base', 'missing-plan'],
            knownName: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, 'iron-plate'],
            unknownName: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, 'unknown'],
            emptyName: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, ''],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, 'missing-base', 'missing-plan'],
            stats: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_STATS_BY_ID, 'missing-base', 'missing-plan'],
            viewModel: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, 'missing-base', 'missing-plan'],
            requirements: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, 'missing-base', 'missing-plan'],
        } as const);

        expect(modal.current()).toMatchObject({
            state: {
                isOpen: false,
                baseId: null,
                editSectionId: null,
                name: '',
                selectedItemId: '',
                targetAmount: 60,
                selectedCorporationLevel: null,
                selectedInputIds: [],
                recipeSelections: {},
                matchInputs: false,
            },
            open: { isOpen: false },
            header: { isEditMode: false },
            form: {
                defaultName: '',
                currentSelectedItemId: '',
                currentTargetAmount: 60,
                selectedItemName: '',
                matchInputs: false,
            },
            flow: { nodes: [], edges: [], rawMaterialDeficits: [] },
            options: [],
            levels: [],
            inputs: { inputItems: [], selectedInputIds: [] },
            outputs: [],
            selectedItem: '',
            deficits: [],
            valid: false,
        });
        expect(missing.current()).toMatchObject({
            ids: [],
            entity: null,
            knownName: 'Iron Plate',
            unknownName: 'unknown',
            emptyName: '',
            flow: { nodes: [], edges: [], rawMaterialDeficits: [] },
            stats: { buildingCount: 0, totalHeat: 0, totalPowerConsumption: 0 },
            viewModel: null,
            requirements: {
                allRequirementsSatisfied: false,
                planStatus: 'inactive',
                hasError: false,
                hasMaterialShortage: false,
                itemName: '',
                corporationName: null,
            },
        });

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        expect(modal.value('open')).toEqual({ isOpen: false });
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Ignored without a base']);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
        expect(modal.value('state').name).toBe('');

        await app.dispatch([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, 'missing-base', 'missing-plan']);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, 'missing-base', 'missing-plan']);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_DELETE_SECTION, 'missing-base', 'missing-plan']);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            'missing-base',
            'missing-plan',
            'missing',
        ]);
        expect(missing.value('entity')).toBeNull();
    });

    it('emulates form validation, input matching, recipe sanitation, creation, reset, and editing', async () => {
        const app = createApp();
        await app.seed();
        const base = app.mountView('plan form base', {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
            plans: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Factory']);
        const baseId = base.value('selected')!.id;
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'inputs',
            1,
            'Ore intake',
            undefined,
            'iron-ore',
            60,
        ]);
        const inputId = base.value('selected')!.buildings[0]!.id;
        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS, {
            'iron-plate': 'smelter_mk2:0',
        }]);

        const modal = app.mountView('plan form', {
            state: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE],
            header: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA],
            form: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW],
            options: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS],
            levels: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS],
            inputs: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA],
            deficits: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS],
            valid: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY],
        } as const);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        expect(modal.value('state')).toMatchObject({
            isOpen: true,
            baseId,
            recipeSelections: { 'iron-plate': 'smelter_mk2:0' },
        });
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        expect(base.value('selected')!.productions).toEqual([]);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, '  Iron line  ']);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate']);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 0]);
        expect(modal.value('valid')).toBe(false);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        expect(base.value('selected')!.productions).toEqual([]);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120]);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL,
            { corporationId: 'miners', level: 1 },
        ]);
        expect(modal.value('levels')).toMatchObject([{ corporationId: 'miners', level: 1 }]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate']);
        expect(modal.value('state').selectedCorporationLevel).toBeNull();

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            'iron-ore',
            'ore_excavator:0',
        ]);
        expect(modal.value('state').recipeSelections['iron-ore']).toBeUndefined();
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            'iron-plate',
            'smelter:0',
        ]);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            'iron-plate',
            null,
        ]);
        expect(modal.value('state').recipeSelections['iron-plate']).toBeUndefined();
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            'iron-plate',
            'smelter:0',
        ]);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS,
            {
                'iron-ore': 'ore_excavator:0',
                'iron-plate': 'smelter:0',
            },
        ]);
        expect(modal.value('state').recipeSelections).toEqual({ 'iron-plate': 'smelter:0' });

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, true]);
        expect(modal.value('state')).toMatchObject({ matchInputs: true, targetAmount: 60 });
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 999]);
        expect(modal.value('state').targetAmount).toBe(60);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        expect(modal.value('inputs').selectedInputIds).toEqual([]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, false]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120]);

        expect(modal.value('form')).toMatchObject({
            defaultName: '  Iron line  ',
            currentSelectedItemId: 'iron-plate',
            currentTargetAmount: 120,
            selectedItemName: 'Iron Plate',
            matchInputs: false,
        });
        expect(modal.value('flow').nodes.length).toBeGreaterThan(0);
        expect(modal.value('options')).toHaveLength(1);
        expect(modal.value('deficits')).toMatchObject([{
            itemId: 'iron-ore',
            required: 120,
            available: 60,
            missing: 60,
            itemName: 'Iron Ore',
        }]);
        expect(modal.value('valid')).toBe(true);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        const plan = base.value('selected')!.productions[0]!;
        expect(plan).toMatchObject({
            name: 'Iron line',
            selectedItemId: 'iron-plate',
            targetAmount: 120,
            inputs: [{ id: inputId, selectedItemId: 'iron-ore', ratePerMinute: 60 }],
            requiredBuildings: [{ buildingId: 'smelter', count: 2 }],
            recipeSelections: { 'iron-plate': 'smelter:0' },
        });
        expect(base.value('plans')).toMatchObject([{ id: plan.id, name: 'Iron line' }]);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
        expect(modal.value('state')).toMatchObject({
            isOpen: false,
            baseId: null,
            name: '',
            selectedInputIds: [],
        });

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, plan.id]);
        expect(modal.value('header')).toEqual({ isEditMode: true });
        expect(modal.value('form')).toMatchObject({
            defaultName: 'Iron line',
            currentTargetAmount: 120,
        });
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Updated line']);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 60]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        expect(base.value('selected')!.productions).toMatchObject([{
            id: plan.id,
            name: 'Updated line',
            targetAmount: 60,
        }]);
    });

    it('emulates cross-base linkable outputs, fallback input selection, and idempotent linking', async () => {
        const app = createApp();
        await app.seed();
        const bases = app.mountView('link output bases', {
            list: [appIds.subscriptions.BASES_LIST],
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
        } as const);

        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Source']);
        const sourceId = bases.value('selected')!.id;
        await app.dispatch([appIds.events.BASES_ADD_BUILDING, sourceId, 'package_dispatcher', 'outputs', 'Source output']);
        const sourceOutputId = bases.value('selected')!.buildings[0]!.id;

        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Target']);
        const targetId = bases.value('selected')!.id;
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        const modal = app.mountView('link output modal', {
            state: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE],
            linkable: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS],
            inputs: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA],
        } as const);

        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            sourceId,
            sourceOutputId,
            'package_receiver',
        ]);
        expect(bases.value('selected')!.buildings).toEqual([]);

        await app.dispatch([appIds.events.BASES_SET_SELECTED_BASE, sourceId]);
        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            sourceId,
            sourceOutputId,
            'iron-ore',
            30,
        ]);
        await app.dispatch([appIds.events.BASES_SET_SELECTED_BASE, targetId]);
        expect(modal.value('linkable')).toMatchObject([{
            baseId: sourceId,
            baseBuildingId: sourceOutputId,
            item: { id: 'iron-ore' },
            ratePerMinute: 30,
            isCurrentBase: false,
        }]);

        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            sourceId,
            sourceOutputId,
            'ore_excavator',
            'Linked ore',
            'Cross-base supply',
        ]);
        let linkedInputs = bases.value('selected')!.buildings.filter(({ linkedOutput }) => (
            linkedOutput?.buildingId === sourceOutputId
        ));
        expect(linkedInputs).toMatchObject([{
            buildingTypeId: 'package_receiver',
            sectionType: 'inputs',
            name: 'Linked ore',
            description: 'Cross-base supply',
            selectedItemId: 'iron-ore',
            ratePerMinute: 30,
        }]);
        expect(modal.value('inputs').selectedInputIds).toEqual([linkedInputs[0]!.id]);

        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            sourceId,
            sourceOutputId,
            'package_receiver',
        ]);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            sourceId,
            sourceOutputId,
        ]);
        linkedInputs = bases.value('selected')!.buildings.filter(({ linkedOutput }) => (
            linkedOutput?.buildingId === sourceOutputId
        ));
        expect(linkedInputs).toHaveLength(1);
        expect(modal.value('state').selectedInputIds).toEqual([linkedInputs[0]!.id]);
    });

    it('emulates section requirements, activation, missing/all provisioning, input failure, and deletion', async () => {
        const app = createApp();
        await app.seed();
        const base = app.mountView('requirements base', {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Factory']);
        const baseId = base.value('selected')!.id;
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'inputs',
            1,
            'Ore intake',
            undefined,
            'iron-ore',
            120,
        ]);
        const inputId = base.value('selected')!.buildings[0]!.id;
        await app.dispatch([appIds.events.BASES_ADD_BUILDING, baseId, 'smelter', 'production']);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await app.dispatchAll([
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Iron requirements'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120],
            [appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId],
            [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT],
        ]);
        const plan = base.value('selected')!.productions[0]!;
        const planView = app.mountView('requirements section', {
            ids: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS],
            entity: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, plan.id],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, plan.id],
            stats: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_STATS_BY_ID, baseId, plan.id],
            model: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, plan.id],
            requirements: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, baseId, plan.id],
            coverage: [appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
            productionBuildings: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'production'],
            inputBuildings: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'inputs'],
        } as const);

        expect(planView.value('ids')).toEqual([plan.id]);
        expect(planView.value('flow').nodes.length).toBeGreaterThan(0);
        expect(planView.value('stats').buildingCount).toBe(3);
        expect(planView.value('model')).toMatchObject({
            itemName: 'Iron Plate',
            buildingRequirements: [{ buildingId: 'smelter', required: 2, available: 1, isSatisfied: false }],
            inputRequirements: [{ baseBuildingId: inputId, isSatisfied: true }],
            allRequirementsSatisfied: false,
            hasError: false,
        });
        expect(planView.value('coverage')).toMatchObject([{ buildingId: 'smelter', missing: 1 }]);

        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'missing',
        ]);
        expect(base.value('selected')!.buildings.filter(({ buildingTypeId }) => (
            buildingTypeId === 'smelter'
        ))).toHaveLength(2);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'missing',
        ]);
        expect(base.value('selected')!.buildings.filter(({ buildingTypeId }) => (
            buildingTypeId === 'smelter'
        ))).toHaveLength(2);
        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'all',
        ]);
        expect(base.value('selected')!.buildings.filter(({ buildingTypeId }) => (
            buildingTypeId === 'smelter'
        ))).toHaveLength(4);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, baseId, plan.id]);
        expect(planView.value('entity')).toMatchObject({ active: true, status: 'active' });
        expect(planView.value('model')?.planStatus).toBe('active');
        expect(planView.value('productionBuildings')).toEqual(expect.arrayContaining([
            expect.objectContaining({
                buildingTypeId: 'smelter',
                activePlanNames: ['Iron requirements'],
            }),
        ]));
        expect(planView.value('inputBuildings')).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: inputId,
                activePlanNames: ['Iron requirements'],
            }),
        ]));

        await app.dispatch([appIds.events.BASES_REMOVE_BUILDING, inputId]);
        expect(planView.value('model')).toMatchObject({
            inputRequirements: [{ baseBuildingId: inputId, isSatisfied: false }],
            hasError: true,
        });
        expect(planView.value('requirements').hasError).toBe(true);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, baseId, plan.id]);
        expect(planView.value('entity')).toMatchObject({ active: false, status: 'inactive' });
        await app.dispatch([appIds.events.PRODUCTION_PLAN_DELETE_SECTION, baseId, plan.id]);
        expect(planView.current()).toMatchObject({ ids: [], entity: null, model: null });
    });

    it('emulates shared-input shortages and corporation launcher provisioning across plans', async () => {
        const app = createApp();
        await app.seed();
        const base = app.mountView('shared plan base', {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
            planRows: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Shared Factory']);
        const baseId = base.value('selected')!.id;
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'inputs',
            1,
            'Shared ore',
            undefined,
            'iron-ore',
            60,
        ]);
        const inputId = base.value('selected')!.buildings[0]!.id;

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await app.dispatchAll([
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Plan A'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate'],
            [appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId],
            [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT],
            [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE],
            [appIds.events.PRODUCTION_PLAN_MODAL_OPEN],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Plan B'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate'],
            [
                appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL,
                { corporationId: 'miners', level: 1 },
            ],
            [appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId],
            [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT],
        ]);
        const [planA, planB] = base.value('selected')!.productions;
        expect(planA).toBeDefined();
        expect(planB).toBeDefined();
        expect(base.value('planRows').map(({ name }) => name)).toEqual(['Plan A', 'Plan B']);

        await app.dispatch([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, baseId, planA!.id]);
        expect(base.value('planRows').map(({ name }) => name)).toEqual(['Plan A', 'Plan B']);
        const planBView = app.mountView('shared plan requirements', {
            model: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, planB!.id],
            requirements: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, baseId, planB!.id],
        } as const);
        expect(planBView.value('model')).toMatchObject({
            sharedInputShortages: [{
                baseBuildingId: inputId,
                itemId: 'iron-ore',
                requiredPerMinute: 120,
                availablePerMinute: 60,
                missingPerMinute: 60,
            }],
            hasMaterialShortage: true,
        });
        expect(planBView.value('requirements').hasMaterialShortage).toBe(true);

        await app.dispatch([
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            planB!.id,
            'missing',
        ]);
        expect(base.value('selected')!.buildings).toEqual(expect.arrayContaining([
            expect.objectContaining({ buildingTypeId: 'smelter' }),
            expect.objectContaining({
                buildingTypeId: 'orbital_cargo_launcher',
                selectedItemId: 'iron-plate',
                ratePerMinute: 10,
            }),
        ]));
    });

    it('emulates prioritized plan-output allocation, normalization, unlinking, and cleanup', async () => {
        const app = createApp();
        await app.seed();
        const base = app.mountView('allocation base', {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Allocation Base']);
        const baseId = base.value('selected')!.id;
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await app.dispatchAll([
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Allocated iron'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120],
            [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT],
        ]);
        const planId = base.value('selected')!.productions[0]!.id;

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_dispatcher',
            'outputs',
            2,
            'Plan output',
            undefined,
            undefined,
            undefined,
            undefined,
            planId,
            'fixed',
            80,
            50,
            0,
        ]);
        const [firstOutput, secondOutput] = base.value('selected')!.buildings.filter(({ sectionType }) => (
            sectionType === 'outputs'
        ));
        await app.dispatch([
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            secondOutput!.id,
            {
                sourceProductionId: planId,
                allocationMode: 'auto',
                requestedRatePerMinute: -1,
                capacityPerMinute: 200,
                priority: 1,
            },
        ]);

        const outputs = app.mountView('allocated outputs', {
            configured: [appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, baseId],
            logistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, baseId],
        } as const);
        expect(outputs.value('configured')).toMatchObject([
            { baseBuildingId: firstOutput!.id, item: { id: 'iron-plate' }, ratePerMinute: 50 },
            { baseBuildingId: secondOutput!.id, item: { id: 'iron-plate' }, ratePerMinute: 70 },
        ]);
        expect(outputs.value('logistics')?.outputs).toMatchObject([
            { baseBuildingId: firstOutput!.id, ratePerMinute: 50, availableCapacityPerMinute: 0 },
            { baseBuildingId: secondOutput!.id, ratePerMinute: 70, availableCapacityPerMinute: 130 },
        ]);

        await app.dispatch([
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            firstOutput!.id,
            { sourceProductionId: null },
        ]);
        expect(base.value('selected')!.buildings.find(({ id }) => id === firstOutput!.id)).not.toMatchObject({
            sourceProductionId: expect.anything(),
            allocationMode: expect.anything(),
        });

        await app.dispatch([
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            firstOutput!.id,
            { sourceProductionId: 'missing-plan', allocationMode: 'fixed' },
        ]);
        expect(base.value('selected')!.buildings.find(({ id }) => id === firstOutput!.id)?.sourceProductionId).toBeUndefined();

        await app.dispatch([appIds.events.PRODUCTION_PLAN_DELETE_SECTION, baseId, planId]);
        expect(base.value('selected')!.productions).toEqual([]);
        expect(base.value('selected')!.buildings.find(({ id }) => id === secondOutput!.id)).not.toMatchObject({
            sourceProductionId: expect.anything(),
            allocationMode: expect.anything(),
            capacityPerMinute: expect.anything(),
            priority: expect.anything(),
        });
    });
});
