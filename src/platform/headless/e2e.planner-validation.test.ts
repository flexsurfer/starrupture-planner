// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { message } from '@/shared/i18n/core';
import { STANDARD_RECIPE_PRESET_ID } from '@/features/planner/recipe-presets';
import { createHeadlessE2EApp, TEST_GAME_DATA, type HeadlessE2EApp } from './e2e-support';

const E = appIds.events;
const S = appIds.subscriptions;

describe('headless planner validation E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = (options: Parameters<typeof createHeadlessE2EApp>[0] = {}) => {
        const app = createHeadlessE2EApp(options);
        apps.push(app);
        return app;
    };
    afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.dispose())); });

    it('resets manual positions for the edited plan when switching or adding a target', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('planner layout', { tab: [S.PLANNER_ACTIVE_TAB], graph: [S.PLANNER_FLOW_GRAPH] } as const);
        await app.dispatchAll([
            [E.PLANNER_CREATE_TAB, 'single', 'Single', 'single'],
            [E.PLANNER_SET_SELECTED_ITEM, 'iron-plate'],
        ]);
        const positions = { [view.value('graph').nodes[0].id]: { x: -50, y: 90 } };
        await app.dispatchAll([
            [E.PLANNER_SET_NODE_POSITIONS, 'single', positions],
            [E.PLANNER_SET_SELECTED_ITEM, 'iron-plate'],
            [E.PLANNER_SET_TARGET_AMOUNT, 120],
        ]);
        expect(view.value('tab')?.nodePositions).toEqual(positions);

        await app.dispatchAll([
            [E.PLANNER_CREATE_TAB, 'multi', 'Multi', 'multi'],
            [E.PLANNER_ADD_TARGET, 'iron-plate'],
            [E.PLANNER_SET_NODE_POSITIONS, 'multi', positions],
            [E.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 120],
            [E.PLANNER_ADD_TARGET, 'iron-plate'],
            [E.PLANNER_ADD_TARGET, 'missing'],
        ]);
        expect(view.value('tab')?.nodePositions).toEqual(positions);
        await app.dispatch([E.PLANNER_ADD_TARGET, 'copper-wire']);
        expect(view.value('tab')?.multiTargets).toHaveLength(2);
        expect(view.value('tab')?.nodePositions).toEqual({});

        await app.dispatch([E.PLANNER_SELECT_TAB, 'single']);
        expect(view.value('tab')?.nodePositions).toEqual(positions);
        await app.dispatch([E.PLANNER_SET_SELECTED_ITEM, 'copper-wire']);
        expect(view.value('tab')?.nodePositions).toEqual({});
    });

    it('keeps multi-target copies independent and refuses circular production recipes', async () => {
        const app = createApp();
        await app.seed('playtest', {
            ...TEST_GAME_DATA,
            buildings: TEST_GAME_DATA.buildings.map(building => building.id === 'wiremill' ? {
                ...building, recipes: building.recipes!.map(recipe => ({ ...recipe, inputs: [{ id: 'copper-wire', amount_per_minute: 45 }] })),
            } : building),
        });
        const view = app.mountView('multi-target editor', {
            tabs: [S.PLANNER_TABS], targets: [S.PLANNER_MULTI_TARGETS], warning: [S.PLANNER_TARGET_WARNING],
            resources: [S.PLANNER_RESOURCES],
        } as const);
        await app.dispatch([E.PLANNER_OPEN_ITEM, 'iron-plate']);
        await app.dispatch([E.PLANNER_CREATE_TAB, 'original', 'Plates', 'multi']);
        expect(view.value('targets')).toEqual([{ itemId: 'iron-plate', amount: 60 }]);
        await app.dispatch([E.PLANNER_ADD_TARGET, 'copper-wire']);
        expect(view.value('targets')).toHaveLength(1);
        expect(view.value('warning')).not.toBeNull();
        await app.dispatch([E.PLANNER_DISMISS_TARGET_WARNING]);
        await app.dispatch([E.PLANNER_ADD_TARGET, 'iron-ore']);
        await app.dispatch([E.PLANNER_ADD_TARGET, 'missing']);
        expect(view.value('targets')).toHaveLength(1);
        await app.dispatch([E.PLANNER_SET_EXTERNAL_INPUT, 'iron-plate', 100]);
        expect(view.value('resources')).toEqual([]);
        await app.dispatch([E.PLANNER_SET_EXTERNAL_INPUT, 'iron-ore', 120]);
        const resourceId = view.value('resources')[0].id;
        await app.dispatch([E.PLANNER_SET_RESOURCE_ENABLED, resourceId, false]);
        await app.dispatch([E.PLANNER_SET_EXTERNAL_INPUT, 'iron-ore', 90]);
        expect(view.value('resources')).toEqual([{ id: resourceId, itemId: 'iron-ore', ratePerMinute: 90, enabled: true }]);
        await app.dispatch([E.PLANNER_DUPLICATE_TAB, 'original', 'copy']);
        await app.dispatch([E.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 180]);
        await app.dispatch([E.PLANNER_SET_EXTERNAL_INPUT, 'iron-ore', 200]);
        expect(view.value('tabs').find(tab => tab.id === 'original')).toMatchObject({
            multiTargets: [{ itemId: 'iron-plate', amount: 60 }], resources: [{ ratePerMinute: 90 }],
        });
        expect(view.value('targets')).toEqual([{ itemId: 'iron-plate', amount: 180 }]);
    });

    it('ignores stale tab actions and invalid resource, target, and camera values', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('planner guard rails', {
            tabs: [S.PLANNER_TABS], resources: [S.PLANNER_RESOURCES], pinned: [S.PLANNER_PINNED_NODES], viewports: [S.PLANNER_VIEWPORTS],
        } as const);
        await app.dispatchAll([
            [E.PLANNER_SET_EXTERNAL_INPUT, 'iron-ore', 10], [E.PLANNER_SET_RECIPE_SELECTIONS, {}],
            [E.PLANNER_REMOVE_TARGET, 'iron-plate'], [E.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 60],
            [E.PLANNER_CLOSE_TAB, 'missing'], [E.PLANNER_SET_PINNED_NODE, 'missing', 'node'],
        ]);
        expect(view.value('tabs')).toEqual([]);
        await app.dispatch([E.PLANNER_CREATE_TAB, 'single', 'Plates', 'single']);
        await app.dispatch([E.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
        await app.dispatchAll([
            [E.PLANNER_SET_EXTERNAL_INPUT, 'iron-plate', 10], [E.PLANNER_SET_EXTERNAL_INPUT, 'unknown', 10],
            [E.PLANNER_SET_EXTERNAL_INPUT, 'iron-ore', -1], [E.PLANNER_SET_EXTERNAL_INPUT, 'iron-ore', NaN],
            [E.PLANNER_REMOVE_TARGET, 'iron-plate'], [E.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 70],
            [E.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 0], [E.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', Infinity],
            [E.PLANNER_SET_VIEWPORT, 'missing', 0, 0, 1], [E.PLANNER_SET_VIEWPORT, 'single', NaN, 0, 1],
            [E.PLANNER_SET_VIEWPORT, 'single', 0, 0, 0.01], [E.PLANNER_SET_VIEWPORT, 'single', 0, 0, 3],
        ]);
        expect(view.value('resources')).toEqual([]);
        expect(view.value('viewports')).toEqual({});
        expect(view.value('tabs')[0]).toMatchObject({ selectedItemId: 'iron-plate', targetAmount: 60, multiTargets: [] });
        await app.dispatch([E.PLANNER_SET_PINNED_NODE, 'single', 'node']);
        expect(view.value('pinned')).toEqual({ single: 'node' });
        await app.dispatch([E.PLANNER_SET_PINNED_NODE, 'single', null]);
        expect(view.value('pinned')).toEqual({});
    });

    it('protects built-in presets and falls back to Standard when a custom default is unset', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('preset validation', { presets: [S.RECIPE_ALTERNATIVE_PRESETS], defaults: [S.PINNED_RECIPE_SELECTIONS] } as const);
        const initial = view.value('presets');
        await app.dispatchAll([
            [E.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, 'missing'],
            [E.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Standard recipes', { 'iron-plate': 'smelter_mk2:0' }, true],
            [E.RECIPE_ALTERNATIVES_RENAME_PRESET, STANDARD_RECIPE_PRESET_ID, 'Replaced'],
        ]);
        expect(view.value('presets')).toEqual(initial);
        await app.dispatch([E.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Fast', { 'iron-plate': 'smelter_mk2:0' }, true]);
        await app.dispatch([E.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Slow', {}]);
        const fast = view.value('presets').find(preset => preset.name === 'Fast')!;
        const slow = view.value('presets').find(preset => preset.name === 'Slow')!;
        expect(fast.id).not.toBe(slow.id);
        expect(view.value('defaults')).toEqual({ 'iron-plate': 'smelter_mk2:0' });
        await app.dispatchAll([
            [E.RECIPE_ALTERNATIVES_RENAME_PRESET, fast.id, ' slow '],
            [E.RECIPE_ALTERNATIVES_RENAME_PRESET, fast.id, ' '],
            [E.RECIPE_ALTERNATIVES_RENAME_PRESET, fast.id, 'x'.repeat(101)],
        ]);
        expect(view.value('presets').find(preset => preset.id === fast.id)?.name).toBe('Fast');
        await app.dispatch([E.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Fast', {}, false]);
        expect(view.value('presets').filter(preset => preset.isDefault).map(preset => preset.id)).toEqual([STANDARD_RECIPE_PRESET_ID]);
        expect(view.value('defaults')).toEqual({});
    });

    it('sorts extractor products and new catalog categories deterministically', async () => {
        const app = createApp();
        await app.seed('playtest', {
            ...TEST_GAME_DATA,
            items: TEST_GAME_DATA.items.map(item => ({ ...item, type: item.id === 'steel-plate' ? 'zeta' : item.id === 'iron-plate' ? 'alpha' : item.type })),
        });
        const view = app.mountView('extended catalog', { items: [S.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'ore_excavator'], details: [S.PLANNER_STATS_DETAILED] } as const);
        expect(view.value('items').map(item => item.id)).toEqual(['copper-ore', 'iron-ore']);
        await app.dispatch([E.PLANNER_OPEN_ITEM, 'steel-plate']);
        await app.dispatch([E.PLANNER_CREATE_TAB, 'extended', 'New categories', 'single']);
        expect(view.value('details').sortedTypes).toEqual(['raw', 'processed', 'alpha', 'zeta']);
    });

    it('reports a missing export sink and previews imports with fresh default IDs', async () => {
        const app = createApp();
        const view = app.mountView('headless transfer', { status: [S.DATA_TRANSFER_STATUS], preview: [S.DATA_TRANSFER_PREVIEW], bases: [S.BASES_LIST] } as const);
        await app.dispatch([E.BASES_CREATE_BASE, 'Existing']);
        await app.dispatch([E.DATA_TRANSFER_EXPORT, { baseIds: null, planIds: null }]);
        expect(view.value('status')).toEqual({ kind: 'error', message: message('No export destination configured.') });
        const archive = { format: 'rupture-planner', version: 2, dataVersion: 'playtest', basesMode: 'planning',
            bases: [{ id: 'source', name: 'Imported', buildings: [], productions: [] }], plans: [], energyGroups: [] };
        await app.dispatch([E.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify(archive)]);
        expect(view.value('preview')?.bases[0]).toMatchObject({ name: 'Imported' });
        expect(view.value('preview')?.bases[0].id).not.toBe('source');
        expect(view.value('bases').map(base => base.name)).toEqual(['Existing']);
        await app.dispatch([E.DATA_TRANSFER_CONFIRM_IMPORT]);
        expect(view.value('bases').map(base => base.name)).toEqual(['Existing', 'Imported']);
    });

    it('surfaces unexpected archive adapter errors without importing a partial document', async () => {
        const app = createApp({ application: { effects: { createImportId: () => { throw new Error('ID provider failed'); } } } });
        const view = app.mountView('failed transfer', { status: [S.DATA_TRANSFER_STATUS], preview: [S.DATA_TRANSFER_PREVIEW] } as const);
        await app.dispatch([E.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify({ format: 'rupture-planner', version: 2, dataVersion: 'playtest', basesMode: null,
            bases: [{ id: 'source', name: 'Imported', buildings: [], productions: [] }], plans: [], energyGroups: [] })]);
        expect(view.value('status')).toEqual({ kind: 'error', message: message('Could not read this export.') });
        expect(view.value('preview')).toBeNull();
    });
});
