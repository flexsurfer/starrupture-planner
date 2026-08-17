// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { AppVersionedGameData } from '@/app/uklad/model';
import {
    createHeadlessE2EApp,
    TEST_GAME_DATA,
    type HeadlessE2EApp,
} from './e2e-support';

describe('headless catalog and planner E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = () => {
        const app = createHeadlessE2EApp();
        apps.push(app);
        return app;
    };

    afterEach(async () => {
        await Promise.all(apps.splice(0).map((app) => app.dispose()));
    });

    it('emulates every empty and missing catalog/planner view', async () => {
        const app = createApp();
        const view = app.mountView('empty catalog and planner', {
            items: [appIds.subscriptions.ITEMS_LIST],
            itemsById: [appIds.subscriptions.ITEMS_BY_ID_MAP],
            selectedCategory: [appIds.subscriptions.ITEMS_SELECTED_CATEGORY],
            selectedBuilding: [appIds.subscriptions.ITEMS_SELECTED_BUILDING],
            searchTerm: [appIds.subscriptions.ITEMS_SEARCH_TERM],
            categories: [appIds.subscriptions.ITEMS_CATEGORIES],
            filteredItems: [appIds.subscriptions.ITEMS_FILTERED_LIST],
            tableRows: [appIds.subscriptions.ITEMS_TABLE_ROWS],
            helperLookups: [appIds.subscriptions.ITEMS_HELPER_LOOKUPS],
            productionBuildings: [appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS],
            missingBuildingItems: [appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'missing'],
            emptyInputRecipes: [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, ''],
            buildings: [appIds.subscriptions.BUILDINGS_LIST],
            buildingsById: [appIds.subscriptions.BUILDINGS_BY_ID_MAP],
            sortedBuildings: [appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST],
            corporations: [appIds.subscriptions.CORPORATIONS_LIST],
            corporationsWithStats: [appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS],
            corporationSummary: [appIds.subscriptions.CORPORATIONS_STATS_SUMMARY],
            selectedItemId: [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            selectedCorporationLevel: [appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL],
            recipeSelections: [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
            pinnedSelections: [appIds.subscriptions.PINNED_RECIPE_SELECTIONS],
            presets: [appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS],
            targetAmount: [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            corporationLevels: [appIds.subscriptions.PLANNER_AVAILABLE_CORPORATION_LEVELS],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            recipeOptions: [appIds.subscriptions.PLANNER_RECIPE_OPTIONS],
            graph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            stats: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
            details: [appIds.subscriptions.PLANNER_STATS_DETAILED],
            selectableItems: [appIds.subscriptions.PLANNER_SELECTABLE_ITEMS],
        } as const);

        expect(view.current()).toMatchObject({
            items: [],
            itemsById: {},
            selectedCategory: 'all',
            selectedBuilding: 'all',
            searchTerm: '',
            categories: [],
            filteredItems: [],
            tableRows: [],
            productionBuildings: ['all'],
            missingBuildingItems: [],
            emptyInputRecipes: [],
            buildings: [],
            buildingsById: {},
            sortedBuildings: [],
            corporations: [],
            corporationsWithStats: [],
            corporationSummary: { totalCorporations: 0, totalLevels: 0, totalCost: 0 },
            selectedItemId: null,
            selectedCorporationLevel: null,
            recipeSelections: {},
            pinnedSelections: {},
            presets: [],
            targetAmount: 60,
            corporationLevels: [],
            flow: { nodes: [], edges: [] },
            recipeOptions: [],
            graph: { nodes: [], edges: [] },
            stats: { totalBuildings: 0, totalEnergy: 0, totalHotness: 0 },
            selectableItems: [],
        });
        expect(view.value('helperLookups').corporationNameToId.size).toBe(0);
        expect(view.value('helperLookups').buildingCorporationUsage.size).toBe(0);
        expect(view.value('details')).toMatchObject({
            buildingStats: [],
            totalEnergy: 0,
            totalHotness: 0,
            totalBuildings: 0,
            sortedTypes: [],
        });

        const filteredHistoryLength = view.history('filteredItems').length;
        await app.dispatch([appIds.events.UI_SET_THEME, 'light']);
        expect(view.history('filteredItems')).toHaveLength(filteredHistoryLength);
    });

    it('emulates category, building, name/id search, empty-result, and reset filters', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('item filters', {
            category: [appIds.subscriptions.ITEMS_SELECTED_CATEGORY],
            building: [appIds.subscriptions.ITEMS_SELECTED_BUILDING],
            search: [appIds.subscriptions.ITEMS_SEARCH_TERM],
            filtered: [appIds.subscriptions.ITEMS_FILTERED_LIST],
        } as const);

        await app.dispatch([appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'raw']);
        expect(view.value('filtered').map(({ id }) => id)).toEqual(['copper-ore', 'iron-ore']);

        await app.dispatch([appIds.events.ITEMS_SET_SELECTED_BUILDING, 'Smelter']);
        expect(view.value('filtered')).toEqual([]);

        await app.dispatch([appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'all']);
        expect(view.value('filtered').map(({ id }) => id)).toEqual(['iron-plate']);

        await app.dispatch([appIds.events.ITEMS_SET_SEARCH_TERM, 'IRON-PLATE']);
        expect(view.value('filtered').map(({ id }) => id)).toEqual(['iron-plate']);

        await app.dispatchAll([
            [appIds.events.ITEMS_SET_SELECTED_BUILDING, 'all'],
            [appIds.events.ITEMS_SET_SEARCH_TERM, 'ore'],
        ]);
        expect(view.value('filtered').map(({ id }) => id)).toEqual(['copper-ore', 'iron-ore']);

        await app.dispatch([appIds.events.ITEMS_SET_SEARCH_TERM, 'does-not-exist']);
        expect(view.value('filtered')).toEqual([]);

        await app.dispatchAll([
            [appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'all'],
            [appIds.events.ITEMS_SET_SELECTED_BUILDING, 'all'],
            [appIds.events.ITEMS_SET_SEARCH_TERM, ''],
        ]);
        expect(view.current()).toMatchObject({ category: 'all', building: 'all', search: '' });
        expect(view.value('filtered')).toHaveLength(5);
    });

    it('emulates catalog joins, special building queries, sorting, and corporation summaries', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('catalog read models', {
            categories: [appIds.subscriptions.ITEMS_CATEGORIES],
            productionBuildings: [appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS],
            storageItems: [appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'package_receiver'],
            smelterItems: [appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'smelter'],
            missingItems: [appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'missing'],
            ironRecipes: [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, 'iron-ore'],
            unknownRecipes: [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, 'unknown'],
            tableRows: [appIds.subscriptions.ITEMS_TABLE_ROWS],
            helpers: [appIds.subscriptions.ITEMS_HELPER_LOOKUPS],
            sortedBuildings: [appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST],
            corporations: [appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS],
            summary: [appIds.subscriptions.CORPORATIONS_STATS_SUMMARY],
        } as const);

        expect(view.value('categories')).toEqual(['all', 'raw', 'processed', 'component']);
        expect(view.value('productionBuildings')).toEqual([
            'Assembler',
            'Ore Excavator',
            'Smelter',
            'Smelter Mk.2',
            'Wiremill',
            'all',
        ]);
        expect(view.value('storageItems').map(({ id }) => id)).toEqual([
            'copper-ore',
            'copper-wire',
            'iron-ore',
            'iron-plate',
            'steel-plate',
        ]);
        expect(view.value('smelterItems').map(({ id }) => id)).toEqual(['iron-plate']);
        expect(view.value('missingItems')).toEqual([]);
        expect(view.value('ironRecipes').map(({ building }) => building.id)).toEqual([
            'smelter',
            'smelter_mk2',
        ]);
        expect(view.value('unknownRecipes')).toEqual([]);

        const ironRow = view.value('tableRows').find(({ item }) => item.id === 'iron-plate');
        expect(ironRow).toMatchObject({
            producingBuildings: ['Smelter', 'Smelter Mk.2'],
            corporationUsage: [{ corporation: 'Miners', level: 1 }],
        });
        expect(view.value('helpers').corporationNameToId.get('Engineers')).toBe('engineers');
        expect(view.value('helpers').buildingCorporationUsage.get('Smelter')).toEqual([
            { corporation: 'Miners', level: 1 },
        ]);

        const sortedBuildingIds = view.value('sortedBuildings').map(({ id }) => id);
        expect(sortedBuildingIds.indexOf('smelter_mk2')).toBe(sortedBuildingIds.indexOf('smelter') + 1);
        expect(sortedBuildingIds.indexOf('smelter')).toBeLessThan(sortedBuildingIds.indexOf('assembler'));
        expect(view.value('corporations')).toMatchObject([
            { name: 'Miners', stats: { totalLevels: 1, totalComponents: 2, totalCost: 100 } },
            { name: 'Engineers', stats: { totalLevels: 1, totalComponents: 1, totalCost: 0 } },
        ]);
        expect(view.value('summary')).toEqual({
            totalCorporations: 2,
            totalLevels: 2,
            totalCost: 100,
        });
    });

    it('keeps every production building visible when upgrade metadata forms a cycle', async () => {
        const app = createApp();
        const cyclicUpgradeData: AppVersionedGameData = {
            ...TEST_GAME_DATA,
            buildings: TEST_GAME_DATA.buildings.map((building) => (
                building.id === 'smelter_mk2'
                    ? { ...building, upgrade: 'smelter' }
                    : building
            )),
        };
        await app.seed('playtest', cyclicUpgradeData);
        const view = app.mountView('cyclic upgrades', {
            sortedBuildings: [appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST],
        } as const);

        const ids = view.value('sortedBuildings').map(({ id }) => id);
        expect(ids).toHaveLength(cyclicUpgradeData.buildings.filter(({ type }) => (
            type === 'production'
        )).length);
        expect(ids).toEqual(expect.arrayContaining(['smelter', 'smelter_mk2']));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('emulates planner defaults, alternatives, corporation mode, graphs, stats, and resets', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('planner', {
            selectedItem: [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            corporationLevel: [appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL],
            selections: [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
            target: [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            corporationLevels: [appIds.subscriptions.PLANNER_AVAILABLE_CORPORATION_LEVELS],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            options: [appIds.subscriptions.PLANNER_RECIPE_OPTIONS],
            graph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            stats: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
            details: [appIds.subscriptions.PLANNER_STATS_DETAILED],
            selectable: [appIds.subscriptions.PLANNER_SELECTABLE_ITEMS],
            activeTab: [appIds.subscriptions.UI_ACTIVE_TAB],
        } as const);

        await app.dispatch([appIds.events.PLANNER_OPEN_ITEM, 'unknown-item']);
        expect(view.current()).toMatchObject({
            selectedItem: 'unknown-item',
            target: 60,
            flow: { nodes: [], edges: [] },
            options: [],
            activeTab: 'planner',
        });

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS, {
            'iron-plate': 'smelter:0',
        }]);
        await app.dispatch([
            appIds.events.PLANNER_OPEN_ITEM,
            'iron-plate',
            { corporationId: 'miners', level: 1 },
        ]);
        expect(view.current()).toMatchObject({
            selectedItem: 'iron-plate',
            corporationLevel: { corporationId: 'miners', level: 1 },
            selections: { 'iron-plate': 'smelter:0' },
            target: 60,
        });
        expect(view.value('corporationLevels')).toMatchObject([
            { corporationId: 'miners', level: 1, points: 2, cost: 50 },
        ]);
        expect(view.value('flow').nodes.some(({ buildingId }) => (
            buildingId === 'orbital_cargo_launcher'
        ))).toBe(true);

        await app.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter_mk2:0']);
        await app.dispatch([appIds.events.PLANNER_SET_TARGET_AMOUNT, 120]);
        expect(view.value('selections')).toEqual({ 'iron-plate': 'smelter_mk2:0' });
        expect(view.value('options')).toMatchObject([{
            itemId: 'iron-plate',
            selectedKey: 'smelter_mk2:0',
        }]);
        expect(view.value('graph').nodes.length).toBeGreaterThan(0);
        expect(view.value('stats').totalBuildings).toBeGreaterThan(0);
        expect(view.value('details').buildingStats.length).toBeGreaterThan(0);
        expect(view.value('details').sortedTypes).toContain('processed');

        await app.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', null]);
        expect(view.value('selections')).toEqual({});
        await app.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, '', 'smelter:0']);
        expect(view.value('selections')).toEqual({});
        await app.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTIONS, {
            'iron-plate': 'smelter:0',
            'copper-wire': 'wiremill:0',
        }]);
        expect(view.value('selections')).toEqual({
            'iron-plate': 'smelter:0',
            'copper-wire': 'wiremill:0',
        });

        await app.dispatch([appIds.events.PLANNER_SET_TARGET_AMOUNT, -5]);
        expect(view.value('target')).toBe(-5);
        expect(view.value('flow').nodes.length).toBeGreaterThan(0);

        await app.dispatch([appIds.events.PLANNER_SET_SELECTED_ITEM, null]);
        expect(view.current()).toMatchObject({
            selectedItem: null,
            corporationLevel: null,
            target: 60,
            flow: { nodes: [], edges: [] },
        });

        await app.dispatch([appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate']);
        expect(view.current()).toMatchObject({ selectedItem: 'steel-plate', target: 30 });
        expect(view.value('selectable').map(({ id }) => id)).toEqual([
            'copper-wire',
            'iron-plate',
            'steel-plate',
        ]);

        await app.dispatch([
            appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL,
            { corporationId: 'miners', level: 1 },
        ]);
        expect(view.value('corporationLevel')).toEqual({ corporationId: 'miners', level: 1 });
        await app.dispatch([appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL, null]);
        expect(view.value('corporationLevel')).toBeNull();
    });

    it('emulates preset validation, normalization, case-insensitive replacement, and deletion', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('recipe presets', {
            pinned: [appIds.subscriptions.PINNED_RECIPE_SELECTIONS],
            presets: [appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS],
        } as const);

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, '   ', {}]);
        expect(view.value('presets')).toEqual([]);

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS, {
            'iron-plate': 'smelter:0',
        }]);
        expect(view.value('pinned')).toEqual({ 'iron-plate': 'smelter:0' });

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, '  Fast   line  ', {
            'iron-plate': 'smelter:0',
        }]);
        const [created] = view.value('presets');
        expect(created).toMatchObject({
            name: 'Fast line',
            selections: { 'iron-plate': 'smelter:0' },
        });

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'fast LINE', {
            'iron-plate': 'smelter_mk2:0',
        }]);
        expect(view.value('presets')).toHaveLength(1);
        expect(view.value('presets')[0]).toMatchObject({
            id: created!.id,
            name: 'Fast line',
            selections: { 'iron-plate': 'smelter_mk2:0' },
        });

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, '']);
        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, 'missing']);
        expect(view.value('presets')).toHaveLength(1);

        await app.dispatch([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, created!.id]);
        expect(view.value('presets')).toEqual([]);
    });
});
