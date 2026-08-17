// @vitest-environment node

import {
    createUkladHeadlessScenario,
    type UkladHeadlessScenario,
    type UkladHeadlessViewQueries,
} from '@ukladjs/core/testing';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { AppVersionedGameData } from '@/app/uklad/model';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from './register';

type AppScenario = UkladHeadlessScenario<AppContracts>;
type AppEvent = Parameters<AppScenario['dispatch']>[0];

const TEST_GAME_DATA = {
    items: [
        { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
        { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
        { id: 'steel-plate', name: 'Steel Plate', type: 'component' },
    ],
    buildings: [
        {
            id: 'base_core',
            name: 'Base Core',
            type: 'infrastructure',
            levels: [
                { level: 0, heatCapacity: 100 },
                { level: 1, heatCapacity: 200 },
            ],
        },
        {
            id: 'ore_excavator',
            name: 'Ore Excavator',
            type: 'production',
            power: 5,
            heat: 2,
            recipes: [{
                output: { id: 'iron-ore', amount_per_minute: 60 },
                inputs: [],
            }],
        },
        {
            id: 'smelter',
            name: 'Smelter',
            type: 'production',
            upgrade: 'smelter_mk2',
            power: 10,
            heat: 5,
            recipes: [{
                output: { id: 'iron-plate', amount_per_minute: 60 },
                inputs: [{ id: 'iron-ore', amount_per_minute: 60 }],
            }],
        },
        {
            id: 'smelter_mk2',
            name: 'Smelter Mk.2',
            type: 'production',
            power: 18,
            heat: 8,
            recipes: [{
                output: { id: 'iron-plate', amount_per_minute: 120 },
                inputs: [{ id: 'iron-ore', amount_per_minute: 120 }],
            }],
        },
        {
            id: 'assembler',
            name: 'Assembler',
            type: 'production',
            power: 15,
            heat: 7,
            recipes: [{
                output: { id: 'steel-plate', amount_per_minute: 30 },
                inputs: [{ id: 'iron-plate', amount_per_minute: 60 }],
            }],
        },
        { id: 'package_receiver', name: 'Package Receiver', type: 'storage', power: 1 },
        { id: 'power_generator', name: 'Power Generator', type: 'generator', power: 100, heat: 2 },
        { id: 'base_core_amplifier_v1', name: 'Core Amplifier', type: 'temperature', coreHeatCapacity: 50 },
        { id: 'turret', name: 'Turret', type: 'defense', power: 4, heat: 3 },
        { id: 'orbital_cargo_launcher', name: 'Orbital Cargo Launcher', type: 'storage', power: 20, heat: 10 },
    ],
    corporations: {
        Miners: {
            id: 'miners',
            levels: [{
                level: 1,
                xp: 100,
                components: [
                    { id: 'iron-plate', points: 2 },
                    { id: 'steel-plate', points: 4 },
                ],
                rewards: [{ name: 'Smelter' }],
            }],
        },
    },
} satisfies AppVersionedGameData;

const scenarios: AppScenario[] = [];
const exercisedEventIds = new Set<string>();
const observedSubscriptionIds = new Set<string>();
let runtimeSequence = 0;

function createScenario(): AppScenario {
    runtimeSequence += 1;
    const runtime = createAppRuntime({ runtimeId: `headless-e2e-${runtimeSequence}` });
    registerHeadlessApplication(runtime);
    const scenario = createUkladHeadlessScenario(runtime);
    scenarios.push(scenario);
    return scenario;
}

async function dispatch(scenario: AppScenario, event: AppEvent): Promise<void> {
    exercisedEventIds.add(event[0]);
    scenario.dispatch(event);
    await scenario.settle();
}

async function dispatchAll(scenario: AppScenario, events: AppEvent[]): Promise<void> {
    for (const event of events) {
        exercisedEventIds.add(event[0]);
        scenario.dispatch(event);
    }
    await scenario.settle();
}

function mountView<TQueries extends UkladHeadlessViewQueries<AppContracts>>(
    scenario: AppScenario,
    name: string,
    queries: TQueries,
) {
    for (const query of Object.values(queries)) observedSubscriptionIds.add(query[0]);
    return scenario.mountView(name, queries);
}

async function createSeededScenario(): Promise<AppScenario> {
    const scenario = createScenario();
    await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', TEST_GAME_DATA]);
    return scenario;
}

afterEach(async () => {
    await Promise.all(scenarios.splice(0).map((scenario) => scenario.dispose()));
});

afterAll(() => {
    expect([...exercisedEventIds].sort()).toEqual(Object.values(appIds.events).sort());
    expect([...observedSubscriptionIds].sort()).toEqual(Object.values(appIds.subscriptions).sort());
});

describe('headless application E2E', () => {
    it('boots the Node adapter, changes data versions, and drives shell controls', async () => {
        const scenario = createScenario();
        const shell = mountView(scenario, 'application shell', {
            version: [appIds.subscriptions.APP_DATA_VERSION],
            versions: [appIds.subscriptions.APP_DATA_VERSIONS],
            theme: [appIds.subscriptions.UI_THEME],
            pending: [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING],
            activeTab: [appIds.subscriptions.UI_ACTIVE_TAB],
            confirmation: [appIds.subscriptions.UI_CONFIRMATION_DIALOG],
            items: [appIds.subscriptions.ITEMS_LIST],
        } as const);

        await dispatch(scenario, [appIds.events.APP_INIT]);
        await vi.waitFor(async () => {
            await scenario.settle();
            expect(shell.value('items').length).toBeGreaterThan(0);
        });

        expect(shell.value('version')).toBe('update1');
        expect(shell.value('versions')).toHaveLength(4);

        await dispatch(scenario, [appIds.events.UI_SET_THEME, 'light']);
        await dispatch(scenario, [appIds.events.UI_SET_ACTIVE_TAB, 'corporations']);
        expect(shell.current()).toMatchObject({ theme: 'light', activeTab: 'corporations' });

        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        await dispatch(scenario, [
            appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
            'Delete plan?',
            'This cannot be undone.',
            onConfirm,
            { confirmLabel: 'Delete', cancelLabel: 'Keep', onCancel },
        ]);
        expect(shell.value('confirmation')).toMatchObject({
            isOpen: true,
            title: 'Delete plan?',
            confirmLabel: 'Delete',
            cancelLabel: 'Keep',
        });
        shell.value('confirmation').onConfirm();
        shell.value('confirmation').onCancel?.();
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();

        await dispatch(scenario, [appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]);
        expect(shell.value('confirmation').isOpen).toBe(false);

        await dispatch(scenario, [appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'playtest']);
        await vi.waitFor(async () => {
            await scenario.settle();
            expect(shell.value('version')).toBe('playtest');
            expect(shell.value('pending')).toBe(false);
        });

        await dispatch(scenario, [appIds.events.APP_GAME_DATA_LOAD_FAILED]);
        expect(shell.value('pending')).toBe(false);
    });

    it('filters the catalog and runs the complete planner workflow', async () => {
        const scenario = await createSeededScenario();
        const catalog = mountView(scenario, 'catalog and planner', {
            items: [appIds.subscriptions.ITEMS_LIST],
            itemsById: [appIds.subscriptions.ITEMS_BY_ID_MAP],
            filteredItems: [appIds.subscriptions.ITEMS_FILTERED_LIST],
            selectedCategory: [appIds.subscriptions.ITEMS_SELECTED_CATEGORY],
            selectedBuilding: [appIds.subscriptions.ITEMS_SELECTED_BUILDING],
            availableItems: [appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'smelter'],
            productionBuildings: [appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS],
            searchTerm: [appIds.subscriptions.ITEMS_SEARCH_TERM],
            categories: [appIds.subscriptions.ITEMS_CATEGORIES],
            tableRows: [appIds.subscriptions.ITEMS_TABLE_ROWS],
            helperLookups: [appIds.subscriptions.ITEMS_HELPER_LOOKUPS],
            recipesUsingIron: [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, 'iron-ore'],
            buildings: [appIds.subscriptions.BUILDINGS_LIST],
            buildingsById: [appIds.subscriptions.BUILDINGS_BY_ID_MAP],
            sortedProductionBuildings: [appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST],
            corporations: [appIds.subscriptions.CORPORATIONS_LIST],
            corporationsWithStats: [appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS],
            corporationSummary: [appIds.subscriptions.CORPORATIONS_STATS_SUMMARY],
            selectedItemId: [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            selectedCorporationLevel: [appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL],
            recipeSelections: [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
            pinnedRecipeSelections: [appIds.subscriptions.PINNED_RECIPE_SELECTIONS],
            recipePresets: [appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS],
            recipeOptions: [appIds.subscriptions.PLANNER_RECIPE_OPTIONS],
            corporationLevels: [appIds.subscriptions.PLANNER_AVAILABLE_CORPORATION_LEVELS],
            targetAmount: [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            productionFlow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            flowGraph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            statsSummary: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
            statsDetailed: [appIds.subscriptions.PLANNER_STATS_DETAILED],
            selectableItems: [appIds.subscriptions.PLANNER_SELECTABLE_ITEMS],
        } as const);

        await dispatchAll(scenario, [
            [appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'processed'],
            [appIds.events.ITEMS_SET_SELECTED_BUILDING, 'Smelter'],
            [appIds.events.ITEMS_SET_SEARCH_TERM, 'plate'],
        ]);

        expect(catalog.value('filteredItems')).toEqual([
            { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
        ]);
        expect(catalog.value('availableItems').map((item) => item.id)).toEqual(['iron-plate']);
        expect(catalog.value('productionBuildings')).toContain('Smelter');
        expect(catalog.value('tableRows')[0]).toMatchObject({
            item: { id: 'iron-plate' },
            producingBuildings: ['Smelter', 'Smelter Mk.2'],
        });
        expect(catalog.value('helperLookups').corporationNameToId.get('Miners')).toBe('miners');
        expect(catalog.value('recipesUsingIron').map(({ building }) => building.id)).toEqual([
            'smelter',
            'smelter_mk2',
        ]);
        expect(catalog.value('buildingsById').assembler.name).toBe('Assembler');
        expect(catalog.value('corporationsWithStats')[0]).toMatchObject({
            name: 'Miners',
            stats: { totalLevels: 1, totalComponents: 2, totalCost: 100 },
        });
        expect(catalog.value('corporationSummary')).toEqual({
            totalCorporations: 1,
            totalLevels: 1,
            totalCost: 100,
        });

        await dispatch(scenario, [
            appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS,
            { 'iron-plate': 'smelter:0' },
        ]);
        await dispatch(scenario, [appIds.events.PLANNER_OPEN_ITEM, 'iron-plate']);
        await dispatch(scenario, [
            appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL,
            { corporationId: 'miners', level: 1 },
        ]);
        await dispatch(scenario, [
            appIds.events.PLANNER_SET_RECIPE_SELECTION,
            'iron-plate',
            'smelter_mk2:0',
        ]);
        await dispatch(scenario, [
            appIds.events.PLANNER_SET_RECIPE_SELECTIONS,
            { 'iron-plate': 'smelter:0' },
        ]);
        await dispatch(scenario, [appIds.events.PLANNER_SET_TARGET_AMOUNT, 120]);

        expect(catalog.value('selectedItemId')).toBe('iron-plate');
        expect(catalog.value('selectedCorporationLevel')).toEqual({ corporationId: 'miners', level: 1 });
        expect(catalog.value('targetAmount')).toBe(120);
        expect(catalog.value('corporationLevels')).toMatchObject([{ corporationId: 'miners', level: 1 }]);
        expect(catalog.value('productionFlow').nodes.length).toBeGreaterThan(0);
        expect(catalog.value('recipeOptions')).toMatchObject([{
            itemId: 'iron-plate',
            options: [{ buildingId: 'smelter' }, { buildingId: 'smelter_mk2' }],
        }]);
        expect(catalog.value('flowGraph').nodes.length).toBeGreaterThan(0);
        expect(catalog.value('statsSummary').totalBuildings).toBeGreaterThan(0);
        expect(catalog.value('statsDetailed').buildingStats.length).toBeGreaterThan(0);
        expect(catalog.value('selectableItems').map((item) => item.id)).toEqual(['iron-plate', 'steel-plate']);

        await dispatch(scenario, [
            appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET,
            '  Fast   iron  ',
            { 'iron-plate': 'smelter_mk2:0' },
        ]);
        const [preset] = catalog.value('recipePresets');
        expect(preset).toMatchObject({
            name: 'Fast iron',
            selections: { 'iron-plate': 'smelter_mk2:0' },
        });
        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, preset!.id]);
        expect(catalog.value('recipePresets')).toEqual([]);

        await dispatch(scenario, [appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate']);
        expect(catalog.value('selectedItemId')).toBe('steel-plate');
        expect(catalog.value('selectedCorporationLevel')).toBeNull();
        expect(catalog.value('targetAmount')).toBe(30);
    });

    it('manages bases, buildings, logistics, and energy groups', async () => {
        const scenario = await createSeededScenario();
        const bases = mountView(scenario, 'bases root', {
            list: [appIds.subscriptions.BASES_LIST],
            selectedId: [appIds.subscriptions.BASES_SELECTED_BASE_ID],
            selectedTab: [appIds.subscriptions.BASES_SELECTED_DETAIL_TAB],
            energyGroups: [appIds.subscriptions.ENERGY_GROUPS_LIST],
            energyGroupsById: [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP],
        } as const);

        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Alpha']);
        const baseId = bases.value('selectedId')!;
        const baseDetails = mountView(scenario, 'selected base details', {
            collapsedSections: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS],
            collapsedForBase: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID, baseId],
            basesById: [appIds.subscriptions.BASES_BY_ID_MAP],
            baseById: [appIds.subscriptions.BASES_BASE_BY_ID, baseId],
            selectedBase: [appIds.subscriptions.BASES_SELECTED_BASE],
            selectedStats: [appIds.subscriptions.BASES_SELECTED_BASE_DETAIL_STATS],
            detailStats: [appIds.subscriptions.BASES_DETAIL_STATS_BY_BASE_ID, baseId],
            inputItems: [appIds.subscriptions.BASES_INPUT_ITEMS_BY_BASE_ID, baseId],
            outputItems: [appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, baseId],
            defenseBuildings: [appIds.subscriptions.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, baseId],
            sectionBuildings: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'production'],
            sectionStats: [appIds.subscriptions.BASES_BUILDING_SECTION_STATS, baseId, 'production'],
            availableBuildings: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'production'],
            coreLevels: [appIds.subscriptions.BASES_CORE_LEVELS],
            summary: [appIds.subscriptions.BASES_STATS_SUMMARY],
            logistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, baseId],
            allLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS],
            allDetailStats: [appIds.subscriptions.BASES_ALL_DETAIL_STATS],
            planRows: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
            materialRows: [appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS],
            coverageRows: [appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
        } as const);

        await dispatch(scenario, [appIds.events.BASES_UPDATE_BASE_NAME, baseId, 'Main Outpost']);
        await dispatch(scenario, [appIds.events.BASES_OPEN_BASE, baseId, 'plans']);
        expect(bases.value('selectedTab')).toBe('plans');
        await dispatch(scenario, [appIds.events.BASES_SET_SELECTED_BASE, baseId]);
        await dispatch(scenario, [appIds.events.BASES_SET_DETAIL_TAB, 'buildings']);
        await dispatch(scenario, [appIds.events.BASES_SET_CORE_LEVEL, 1]);

        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'package_receiver',
            'outputs',
            'Iron export',
        ]);
        let output = baseDetails.value('selectedBase')!.buildings.find((building) => building.sectionType === 'outputs')!;
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            baseId,
            output.id,
            'iron-plate',
            60,
        ]);

        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'package_receiver',
            'inputs',
            'Iron intake',
        ]);
        const input = baseDetails.value('selectedBase')!.buildings.find((building) => building.sectionType === 'inputs')!;
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            baseId,
            input.id,
            'iron-plate',
            60,
        ]);
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            baseId,
            input.id,
            baseId,
            output.id,
        ]);

        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'smelter',
            'production',
            2,
            'Iron line',
            'Primary smelting',
        ]);
        await dispatch(scenario, [
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'smelter',
            'production',
            3,
        ]);
        await dispatch(scenario, [appIds.events.BASES_ADD_BUILDING, baseId, 'power_generator', 'energy']);
        await dispatch(scenario, [appIds.events.BASES_ADD_BUILDING, baseId, 'turret', 'infrastructure']);
        await dispatch(scenario, [
            appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED,
            baseId,
            'productionPlans',
        ]);

        await dispatch(scenario, [appIds.events.ENERGY_GROUP_CREATE, '  Main   Grid  ', baseId]);
        const [group] = bases.value('energyGroups');
        await dispatch(scenario, [appIds.events.ENERGY_GROUP_RENAME, group!.id, 'Primary Grid']);
        await dispatch(scenario, [appIds.events.BASES_SET_ENERGY_GROUP, baseId, null]);
        await dispatch(scenario, [appIds.events.BASES_SET_ENERGY_GROUP, baseId, group!.id]);

        expect(baseDetails.value('baseById')).toMatchObject({
            name: 'Main Outpost',
            coreLevel: 1,
            energyGroupId: group!.id,
        });
        expect(baseDetails.value('collapsedForBase').productionPlans).toBe(true);
        expect(baseDetails.value('sectionBuildings')).toMatchObject([{
            buildingTypeId: 'smelter',
            count: 3,
            isGrouped: true,
        }]);
        expect(baseDetails.value('sectionStats').buildingCount).toBe(3);
        expect(baseDetails.value('inputItems')[0]).toMatchObject({
            item: { id: 'iron-plate' },
            linkedOutput: { status: 'ok' },
        });
        expect(baseDetails.value('outputItems')[0]).toMatchObject({ item: { id: 'iron-plate' } });
        expect(baseDetails.value('defenseBuildings')).toMatchObject([{ building: { id: 'turret' }, count: 1 }]);
        expect(baseDetails.value('availableBuildings').map((building) => building.id)).toContain('smelter');
        expect(baseDetails.value('coreLevels')).toEqual([
            { level: 0, heatCapacity: 100 },
            { level: 1, heatCapacity: 200 },
        ]);
        expect(baseDetails.value('summary')).toMatchObject({ totalBases: 1, totalBuildings: 7 });
        expect(baseDetails.value('selectedStats')).toMatchObject({ baseName: 'Main Outpost', energyGroupName: 'Primary Grid' });
        expect(baseDetails.value('detailStats')).toMatchObject({ baseName: 'Main Outpost' });
        expect(baseDetails.value('logistics')).toMatchObject({ baseId });
        expect(baseDetails.value('allLogistics')).toHaveLength(1);
        expect(baseDetails.value('allDetailStats')[baseId]).toBeDefined();
        expect(baseDetails.value('planRows')).toEqual([]);
        expect(baseDetails.value('materialRows')).toMatchObject([{
            itemId: 'iron-plate',
            available: 60,
        }]);
        expect(baseDetails.value('coverageRows')).toEqual([]);

        const productionBuilding = baseDetails.value('selectedBase')!.buildings.find((building) => (
            building.sectionType === 'production'
        ))!;
        await dispatch(scenario, [appIds.events.BASES_REMOVE_BUILDING, productionBuilding.id]);
        expect(baseDetails.value('sectionStats').buildingCount).toBe(2);

        await dispatch(scenario, [appIds.events.ENERGY_GROUP_DELETE, group!.id]);
        expect(bases.value('energyGroups')).toEqual([]);
        expect(bases.value('energyGroupsById')).toEqual({});
        expect(baseDetails.value('selectedBase')!.energyGroupId).toBeUndefined();

        output = baseDetails.value('selectedBase')!.buildings.find((building) => building.id === output.id)!;
        expect(output.linkedOutput).toBeUndefined();

        await dispatch(scenario, [appIds.events.BASES_DELETE_BASE, baseId]);
        expect(bases.value('list')).toEqual([]);
        expect(bases.value('selectedId')).toBeNull();
    });

    it('creates, edits, runs, provisions, links, and deletes a production plan', async () => {
        const scenario = await createSeededScenario();
        const bases = mountView(scenario, 'production base', {
            list: [appIds.subscriptions.BASES_LIST],
            selectedBase: [appIds.subscriptions.BASES_SELECTED_BASE],
            planRows: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
            materialRows: [appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS],
            coverageRows: [appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
        } as const);

        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Factory']);
        const baseId = bases.value('selectedBase')!.id;
        await dispatch(scenario, [
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
        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'outputs',
            1,
            'Ore export',
            undefined,
            'iron-ore',
            30,
        ]);

        const inputId = bases.value('selectedBase')!.buildings.find((building) => building.sectionType === 'inputs')!.id;
        const outputId = bases.value('selectedBase')!.buildings.find((building) => building.sectionType === 'outputs')!.id;
        const modal = mountView(scenario, 'production plan modal', {
            state: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE],
            openState: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE],
            header: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA],
            formValues: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW],
            recipeOptions: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS],
            corporationLevels: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS],
            inputSelector: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA],
            linkableOutputs: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS],
            selectedItemId: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID],
            deficits: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS],
            valid: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY],
        } as const);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, ' Iron plates ']);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate']);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL,
            { corporationId: 'miners', level: 1 },
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL,
            null,
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            'iron-plate',
            'smelter_mk2:0',
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS,
            { 'iron-plate': 'smelter:0' },
        ]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            baseId,
            outputId,
            'package_receiver',
            'Linked ore',
        ]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, true]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, false]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120]);

        expect(modal.value('openState')).toEqual({ isOpen: true });
        expect(modal.value('header')).toEqual({ isEditMode: false });
        expect(modal.value('formValues')).toMatchObject({
            defaultName: ' Iron plates ',
            currentSelectedItemId: 'iron-plate',
            currentTargetAmount: 120,
        });
        expect(modal.value('selectedItemId')).toBe('iron-plate');
        expect(modal.value('flow').nodes.length).toBeGreaterThan(0);
        expect(modal.value('recipeOptions')).toHaveLength(1);
        expect(modal.value('corporationLevels')).toMatchObject([{ corporationId: 'miners', level: 1 }]);
        expect(modal.value('inputSelector').selectedInputIds).toHaveLength(2);
        expect(modal.value('linkableOutputs')).toMatchObject([{ baseId, baseBuildingId: outputId }]);
        expect(modal.value('deficits')).toMatchObject([{ itemId: 'iron-ore', itemName: 'Iron Ore' }]);
        expect(modal.value('valid')).toBe(true);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        const plan = bases.value('selectedBase')!.productions[0]!;
        expect(plan).toMatchObject({
            name: 'Iron plates',
            selectedItemId: 'iron-plate',
            targetAmount: 120,
            status: 'inactive',
        });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);

        const planDetails = mountView(scenario, 'production plan section', {
            ids: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS],
            entity: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, plan.id],
            itemName: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, 'iron-plate'],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, plan.id],
            stats: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_STATS_BY_ID, baseId, plan.id],
            viewModel: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, plan.id],
            requirements: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, baseId, plan.id],
        } as const);

        expect(planDetails.value('ids')).toEqual([plan.id]);
        expect(planDetails.value('entity')).toMatchObject({ name: 'Iron plates' });
        expect(planDetails.value('itemName')).toBe('Iron Plate');
        expect(planDetails.value('flow').nodes.length).toBeGreaterThan(0);
        expect(planDetails.value('stats').buildingCount).toBeGreaterThan(0);
        expect(planDetails.value('viewModel')).toMatchObject({
            itemName: 'Iron Plate',
            planStatus: 'inactive',
        });
        expect(planDetails.value('requirements')).toMatchObject({
            itemName: 'Iron Plate',
            planStatus: 'inactive',
        });
        expect(bases.value('planRows')).toMatchObject([{ id: plan.id, name: 'Iron plates' }]);
        expect(bases.value('materialRows')).toHaveLength(1);
        expect(bases.value('coverageRows')).toMatchObject([{ buildingId: 'smelter', missing: 2 }]);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, baseId, plan.id]);
        expect(planDetails.value('entity')).toMatchObject({ active: true, status: 'active' });
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'all',
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'missing',
        ]);
        expect(bases.value('selectedBase')!.buildings.filter((building) => (
            building.buildingTypeId === 'smelter'
        ))).toHaveLength(2);

        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            outputId,
            {
                sourceProductionId: plan.id,
                allocationMode: 'fixed',
                requestedRatePerMinute: 30,
                capacityPerMinute: 60,
                priority: 1,
            },
        ]);
        expect(bases.value('selectedBase')!.buildings.find((building) => building.id === outputId)).toMatchObject({
            selectedItemId: 'iron-plate',
            sourceProductionId: plan.id,
            allocationMode: 'fixed',
            requestedRatePerMinute: 30,
            capacityPerMinute: 60,
            priority: 1,
        });
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            outputId,
            { sourceProductionId: null },
        ]);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, baseId, plan.id]);
        expect(planDetails.value('entity')).toMatchObject({ active: false, status: 'inactive' });

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_OPEN, plan.id]);
        expect(modal.value('header')).toEqual({ isEditMode: true });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Updated iron plates']);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        expect(planDetails.value('entity')).toMatchObject({ name: 'Updated iron plates' });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_DELETE_SECTION, baseId, plan.id]);
        expect(planDetails.value('entity')).toBeNull();
        expect(planDetails.value('ids')).toEqual([]);
    });
});
