// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createHeadlessE2EApp, TEST_GAME_DATA, type HeadlessE2EApp } from './e2e-support';

const E = appIds.events;
const S = appIds.subscriptions;

describe('headless base resilience E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const setup = async () => {
        const app = createHeadlessE2EApp();
        apps.push(app);
        await app.seed();
        const view = app.mountView('base editor', { base: [S.BASES_SELECTED_BASE], bases: [S.BASES_LIST], groups: [S.ENERGY_GROUPS_LIST] } as const);
        await app.dispatch([E.BASES_CREATE_BASE, 'Factory']);
        return { app, view, baseId: view.value('base')!.id };
    };
    afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.dispose())); });

    it('ignores stale base and building actions without changing the remaining factory', async () => {
        const { app, view, baseId } = await setup();
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'smelter', 'production']);
        const buildingId = view.value('base')!.buildings[0].id;
        await app.dispatch([E.BASES_CREATE_BASE, 'Deleted']);
        const deletedId = view.value('base')!.id;
        await app.dispatch([E.BASES_DELETE_BASE, deletedId]);
        const before = view.value('bases');
        await app.dispatchAll([
            [E.BASES_SET_CORE_LEVEL, 2], [E.BASES_SET_ENERGY_GROUP, deletedId, null],
            [E.BASES_ADD_BUILDING, deletedId, 'smelter', 'production'],
            [E.BASES_ADD_BUILDINGS, deletedId, 'smelter', 'production', 2],
            [E.BASES_SET_BUILDING_SECTION_TYPE_COUNT, deletedId, 'smelter', 'production', 3],
            [E.BASES_UPDATE_BUILDING_DETAILS, deletedId, buildingId, 'Renamed', 'Changed'],
            [E.BASES_UPDATE_BUILDING_ITEM_SELECTION, baseId, 'missing', 'iron-plate', 60],
            [E.BASES_UPDATE_BUILDING_LINKED_OUTPUT, deletedId, buildingId, baseId, buildingId],
            [E.BASES_UPDATE_BUILDING_LINKED_OUTPUT, baseId, buildingId, baseId, buildingId],
            [E.BASES_UPDATE_OUTPUT_PLAN_LINK, deletedId, buildingId, { sourceProductionId: null }],
            [E.BASES_UPDATE_OUTPUT_PLAN_LINK, baseId, buildingId, { sourceProductionId: null }],
            [E.BASES_DISCONNECT_CONNECTIONS, [{ source: { baseId, buildingId }, target: { baseId: deletedId, buildingId } }]],
            [E.BASES_ADD_BUILDINGS, baseId, 'package_dispatcher', 'outputs', 1, '', '', 'iron-plate', 60,
                null, null, null, null, null, null, { baseId: deletedId, buildingId }],
            [E.ENERGY_GROUP_RENAME, 'missing', 'Renamed'],
            [E.BASES_SET_SELECTED_BASE, deletedId], [E.BASES_REMOVE_BUILDING, buildingId],
        ]);
        expect(view.value('bases')).toEqual(before);
        expect(view.value('groups')).toEqual([]);
        expect(view.value('base')).toBeNull();
    });

    it('assigns unique duplicate names and refuses duplicate IDs or removed building types', async () => {
        const { app, view, baseId } = await setup();
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'package_receiver', 'inputs']);
        const original = view.value('base')!.buildings[0];
        await app.dispatch([E.BASES_DUPLICATE_BUILDING, baseId, original.id, 'copy-2']);
        await app.dispatch([E.BASES_DUPLICATE_BUILDING, baseId, original.id, 'copy-2']);
        await app.dispatch([E.BASES_DUPLICATE_BUILDING, baseId, original.id, 'copy-3']);
        const defaultName = TEST_GAME_DATA.buildings.find(building => building.id === 'package_receiver')!.name;
        expect(view.value('base')!.buildings.map(building => building.name)).toEqual([undefined, `${defaultName} (2)`, `${defaultName} (3)`]);
        await app.seed('playtest', { ...TEST_GAME_DATA, buildings: TEST_GAME_DATA.buildings.filter(building => building.id !== 'package_receiver') });
        await app.dispatch([E.BASES_DUPLICATE_BUILDING, baseId, original.id, 'copy-4']);
        expect(view.value('base')!.buildings).toHaveLength(3);
    });

    it('keeps stored factories intact when a source base or catalog building disappears', async () => {
        const { app, view, baseId } = await setup();
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'smelter', 'production']);
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'turret', 'infrastructure']);
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'turret', 'infrastructure']);
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'package_receiver', 'inputs']);
        const inputId = view.value('base')!.buildings.at(-1)!.id;
        await app.dispatch([E.ENERGY_GROUP_CREATE, 'Factory grid', baseId]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_OPEN]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate']);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_CLOSE]);
        await app.dispatch([E.BASES_CREATE_BASE, 'External supply']);
        const sourceId = view.value('base')!.id;
        await app.dispatch([E.BASES_ADD_BUILDINGS, sourceId, 'package_dispatcher', 'outputs', 1, '', '', 'iron-ore', 60]);
        const outputId = view.value('base')!.buildings[0].id;
        await app.dispatch([E.BASES_UPDATE_BUILDING_LINKED_OUTPUT, baseId, inputId, sourceId, outputId]);
        await app.dispatch([E.BASES_SET_SELECTED_BASE, baseId]);
        const stats = app.mountView('catalog-aware base details', {
            detail: [S.BASES_SELECTED_BASE_DETAIL_STATS], summary: [S.BASES_STATS_SUMMARY],
            section: [S.BASES_BUILDING_SECTION_STATS, baseId, 'production'], defense: [S.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, baseId],
            inputs: [S.BASES_INPUT_ITEMS_BY_BASE_ID, baseId], materials: [S.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS],
            coverage: [S.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
        } as const);
        expect(stats.value('defense')).toEqual([expect.objectContaining({ count: 2 })]);
        expect(stats.value('materials').find(row => row.itemId === 'iron-ore')).toMatchObject({ available: 60, missing: 0 });
        await app.dispatch([E.BASES_DELETE_BASE, sourceId]);
        expect(stats.value('materials').find(row => row.itemId === 'iron-ore')).toMatchObject({ available: 0, missing: 60 });
        const stored = view.value('base');
        await app.seed('playtest', { ...TEST_GAME_DATA, buildings: TEST_GAME_DATA.buildings.filter(building => !['smelter', 'package_receiver'].includes(building.id)) });
        expect(view.value('base')).toEqual(stored);
        expect(stats.value('inputs')).toEqual([]);
        expect(stats.value('coverage')).toEqual([]);
        expect(stats.value('section')).toMatchObject({ buildingCount: 1, totalHeat: 0, totalPowerConsumption: 0 });
        expect(stats.value('detail')).toMatchObject({ totalHeat: 6, energyConsumption: 8 });
        expect(stats.value('summary')).toMatchObject({ totalBuildings: 4, totalHeat: 6, totalEnergyUsed: 8 });
    });
});
