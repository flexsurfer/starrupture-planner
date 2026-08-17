// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { DATA_VERSIONS } from '@/features/app-shell/data-version';
import {
    createHeadlessE2EApp,
    type HeadlessE2EApp,
} from './e2e-support';

describe('headless bundled game-data compatibility E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = () => {
        const app = createHeadlessE2EApp();
        apps.push(app);
        return app;
    };

    afterEach(async () => {
        await Promise.all(apps.splice(0).map((app) => app.dispose()));
    });

    it.each(DATA_VERSIONS)('loads %s and completes a real-data planning journey', async ({ id: version }) => {
        const app = createApp();
        const catalog = app.mountView(`real ${version} catalog`, {
            version: [appIds.subscriptions.APP_DATA_VERSION],
            pending: [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING],
            items: [appIds.subscriptions.ITEMS_LIST],
            itemsById: [appIds.subscriptions.ITEMS_BY_ID_MAP],
            categories: [appIds.subscriptions.ITEMS_CATEGORIES],
            buildings: [appIds.subscriptions.BUILDINGS_LIST],
            buildingsById: [appIds.subscriptions.BUILDINGS_BY_ID_MAP],
            corporations: [appIds.subscriptions.CORPORATIONS_LIST],
            corporationSummary: [appIds.subscriptions.CORPORATIONS_STATS_SUMMARY],
            productionBuildings: [appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS],
        } as const);

        if (version === 'update1') {
            await app.dispatch([appIds.events.APP_INIT]);
        } else {
            await app.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, version]);
        }
        await vi.waitFor(async () => {
            await app.scenario.settle();
            expect(catalog.value('version')).toBe(version);
            expect(catalog.value('pending')).toBe(false);
            expect(catalog.value('items').length).toBeGreaterThan(0);
            expect(catalog.value('buildings').length).toBeGreaterThan(0);
        }, { timeout: 5_000 });

        expect(Object.keys(catalog.value('itemsById'))).toHaveLength(catalog.value('items').length);
        expect(Object.keys(catalog.value('buildingsById'))).toHaveLength(catalog.value('buildings').length);
        expect(catalog.value('categories')).toContain('all');
        for (const itemType of new Set(catalog.value('items').map(({ type }) => type))) {
            expect(catalog.value('categories')).toContain(itemType);
        }
        expect(catalog.value('corporationSummary').totalCorporations).toBe(catalog.value('corporations').length);
        const expectedProductionBuildings = Array.from(new Set([
            'all',
            ...catalog.value('buildings')
                .filter(({ type }) => type === 'production')
                .map(({ name }) => name),
        ])).sort();
        expect(catalog.value('productionBuildings')).toEqual(expectedProductionBuildings);

        const recipeChoice = catalog.value('buildings')
            .flatMap((building) => (building.recipes ?? []).map((recipe) => ({ building, recipe })))
            .find(({ recipe }) => recipe.inputs.length > 0 && !!catalog.value('itemsById')[recipe.output.id]);
        expect(recipeChoice).toBeDefined();
        const targetItemId = recipeChoice!.recipe.output.id;

        const planner = app.mountView(`real ${version} planner`, {
            selectedItem: [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            target: [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            graph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            stats: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
            options: [appIds.subscriptions.PLANNER_RECIPE_OPTIONS],
        } as const);
        await app.dispatch([appIds.events.PLANNER_OPEN_ITEM, targetItemId]);
        expect(planner.current()).toMatchObject({ selectedItem: targetItemId });
        expect(planner.value('target')).toBeGreaterThan(0);
        expect(planner.value('flow').nodes.length).toBeGreaterThan(0);
        expect(planner.value('graph').nodes.length).toBeGreaterThan(0);
        expect(planner.value('stats').totalBuildings).toBeGreaterThan(0);
        const recipeCountsByOutput = new Map<string, number>();
        for (const building of catalog.value('buildings')) {
            for (const recipe of building.recipes ?? []) {
                recipeCountsByOutput.set(
                    recipe.output.id,
                    (recipeCountsByOutput.get(recipe.output.id) ?? 0) + 1,
                );
            }
        }
        const expectedOptionItemIds = Array.from(new Set(
            planner.value('flow').nodes
                .filter(({ nodeType }) => nodeType === 'production')
                .map(({ outputItem }) => outputItem)
                .filter((itemId) => (recipeCountsByOutput.get(itemId) ?? 0) > 1),
        )).sort();
        expect(planner.value('options').map(({ itemId }) => itemId).sort()).toEqual(expectedOptionItemIds);

        const bases = app.mountView(`real ${version} base`, {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, `${version} factory`]);
        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await app.dispatchAll([
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, `${version} plan`],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, targetItemId],
            [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT],
        ]);
        const createdPlan = bases.value('selected')?.productions[0];
        if (!createdPlan) throw new Error(`Expected a production plan for ${version}`);
        expect(createdPlan).toMatchObject({
            name: `${version} plan`,
            selectedItemId: targetItemId,
        });
        const requiredBuildings = createdPlan.requiredBuildings ?? [];
        expect(requiredBuildings.length).toBeGreaterThan(0);
        expect(requiredBuildings.some(({ buildingId }) => (
            catalog.value('buildingsById')[buildingId]?.recipes?.some(
                ({ output }) => output.id === targetItemId,
            )
        ))).toBe(true);
    });
});
