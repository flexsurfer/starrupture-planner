// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createHeadlessE2EApp, type HeadlessE2EApp } from './e2e-support';

const E = appIds.events;
const S = appIds.subscriptions;

describe('headless production plan lifecycle E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const setup = async () => {
        const app = createHeadlessE2EApp();
        apps.push(app);
        await app.seed();
        const view = app.mountView('planning workspace', {
            base: [S.BASES_SELECTED_BASE], bases: [S.BASES_LIST], modal: [S.PRODUCTION_PLAN_MODAL_STATE],
            inputs: [S.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA], outputs: [S.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS],
            materials: [S.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS], coverage: [S.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
        } as const);
        await app.dispatch([E.BASES_SET_MODE, 'planning']);
        await app.dispatch([E.BASES_CREATE_BASE, 'Factory']);
        const baseId = view.value('base')!.id;
        const createPlan = async (itemId = 'iron-plate') => {
            await app.dispatch([E.PRODUCTION_PLAN_MODAL_OPEN]);
            await app.dispatch([E.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, itemId]);
            return view.value('modal').editSectionId!;
        };
        return { app, view, baseId, createPlan };
    };
    afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.dispose())); });

    it('synchronizes owned inputs and outputs through editing, removal, and plan deletion', async () => {
        const { app, view, baseId, createPlan } = await setup();
        const planId = await createPlan();
        expect(view.value('base')!.productions[0].name).toBe('Iron Plate Production');
        expect(view.value('base')!.buildings).toEqual([expect.objectContaining({ sectionType: 'outputs', planningOwnerPlanId: planId })]);
        await app.dispatch([E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 60, 'package_receiver']);
        const input = view.value('base')!.buildings.find(building => building.sectionType === 'inputs')!;
        expect(view.value('modal').selectedInputIds).toEqual([input.id]);
        expect(view.value('inputs').inputItems).toEqual([expect.objectContaining({ baseBuildingId: input.id, removesBuildingOnDeselect: true })]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_SET_NAME, 'Renamed line']);
        expect(view.value('base')!.buildings.find(building => building.sectionType === 'outputs')?.name).toBe('Renamed line output');
        await app.dispatch([E.PRODUCTION_PLAN_REMOVE_INPUT, baseId, planId, input.id]);
        expect(view.value('base')!.buildings.some(building => building.id === input.id)).toBe(false);
        expect(view.value('modal').selectedInputIds).toEqual([]);
        await app.dispatch([E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 120, 'package_receiver']);
        const replacement = view.value('modal').selectedInputIds[0];
        await app.dispatch([E.BASES_REMOVE_BUILDING, replacement]);
        expect(view.value('base')!.productions[0].inputs).toEqual([]);
        expect(view.value('modal').selectedInputIds).toEqual([]);
        await app.dispatch([E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 60, 'package_receiver']);
        await app.dispatch([E.BASES_ADD_BUILDING, baseId, 'smelter', 'production']);
        await app.dispatch([E.PRODUCTION_PLAN_DELETE_SECTION, baseId, planId]);
        expect(view.value('base')!.productions).toEqual([]);
        expect(view.value('base')!.buildings).toEqual([expect.objectContaining({ buildingTypeId: 'smelter' })]);
    });

    it('preserves physical endpoints when deleting a plan after switching to Advanced mode', async () => {
        const { app, view, baseId, createPlan } = await setup();
        const planId = await createPlan();
        await app.dispatch([E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 60, 'package_receiver']);
        const ids = view.value('base')!.buildings.map(building => building.id);
        await app.dispatch([E.BASES_SET_MODE, 'advanced']);
        await app.dispatch([E.PRODUCTION_PLAN_DELETE_SECTION, baseId, planId]);
        expect(view.value('base')!.buildings.map(building => building.id)).toEqual(ids);
        for (const building of view.value('base')!.buildings) expect(building.planningOwnerPlanId).toBeUndefined();
        expect(view.value('base')!.productions).toEqual([]);
    });

    it('refuses another plan’s owned inputs and retains a manually shared input on deletion', async () => {
        const { app, view, baseId, createPlan } = await setup();
        const first = await createPlan();
        await app.dispatch([E.PRODUCTION_PLAN_ADD_INPUT, baseId, first, 'iron-ore', 60, 'package_receiver']);
        const inputId = view.value('modal').selectedInputIds[0];
        const second = await createPlan();
        expect(view.value('inputs').inputItems).toEqual([]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        expect(view.value('modal').selectedInputIds).toEqual([]);
        await app.dispatch([E.BASES_SET_MODE, 'advanced']);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        expect(view.value('base')!.productions.find(plan => plan.id === second)?.inputs?.map(input => input.id)).toEqual([inputId]);
        await app.dispatch([E.BASES_SET_MODE, 'planning']);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_OPEN, first]);
        expect(view.value('inputs').inputItems).toEqual([expect.objectContaining({ baseBuildingId: inputId, removesBuildingOnDeselect: false })]);
        expect(view.value('materials').find(row => row.itemId === 'iron-ore')).toMatchObject({ totalRequired: 120, available: 60, missing: 60 });
        expect(view.value('coverage').find(row => row.buildingId === 'smelter')).toMatchObject({ totalRequired: 2, missing: 2 });
        await app.dispatch([E.PRODUCTION_PLAN_DELETE_SECTION, baseId, first]);
        expect(view.value('base')!.buildings.find(building => building.id === inputId)?.planningOwnerPlanId).toBeUndefined();
        expect(view.value('base')!.productions[0].id).toBe(second);
        expect(view.value('base')!.productions[0].inputs?.map(input => input.id)).toEqual([inputId]);
    });

    it('links available outputs in the editor, reuses existing receivers, and recalculates closed plans', async () => {
        const { app, view, baseId, createPlan } = await setup();
        await app.dispatch([E.BASES_SET_MODE, 'advanced']);
        await app.dispatch([E.BASES_CREATE_BASE, 'Supply']);
        const sourceId = view.value('base')!.id;
        for (const itemId of ['iron-plate', 'copper-wire']) {
            await app.dispatch([E.BASES_ADD_BUILDINGS, sourceId, 'package_dispatcher', 'outputs', 1, itemId, '', itemId, 120]);
        }
        const outputs = view.value('base')!.buildings;
        await app.dispatch([E.BASES_SET_SELECTED_BASE, baseId]);
        const planId = await createPlan('steel-plate');
        expect(view.value('outputs')).toHaveLength(2);
        const picker = app.mountView('filtered supply', { plates: [S.PRODUCTION_PLAN_LINKABLE_OUTPUTS, baseId, planId, 'iron-plate'] } as const);
        expect(picker.value('plates').map(output => output.item.id)).toEqual(['iron-plate']);
        await app.dispatch([E.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, baseId, planId, sourceId, outputs[0].id]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, sourceId, outputs[1].id]);
        expect(view.value('modal').selectedInputIds).toHaveLength(2);
        expect(view.value('base')!.productions[0].inputs).toHaveLength(2);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_CLOSE]);
        await app.dispatch([E.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, baseId, planId, sourceId, outputs[0].id]);
        expect(view.value('base')!.buildings.filter(building => building.sectionType === 'inputs')).toHaveLength(2);
        expect(view.value('base')!.productions[0].inputs).toHaveLength(2);
        const inputId = view.value('base')!.productions[0].inputs![0].id;
        await app.dispatch([E.PRODUCTION_PLAN_REMOVE_INPUT, baseId, planId, inputId]);
        expect(view.value('base')!.productions[0].inputs).toHaveLength(1);
        await app.dispatch([E.BASES_SET_MODE, 'planning']);
        expect(view.value('outputs')).toEqual([]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_OPEN, planId]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_SET_NAME, '']);
        const before = view.value('base');
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, sourceId, outputs[0].id]);
        expect(view.value('base')).toEqual(before);
    });

    it('ignores invalid inputs and stale editor actions after its plan or base is deleted', async () => {
        const { app, view, baseId, createPlan } = await setup();
        const planId = await createPlan();
        const before = view.value('base');
        await app.dispatchAll([
            [E.PRODUCTION_PLAN_ADD_INPUT, 'missing', planId, 'iron-ore', 60, 'package_receiver'],
            [E.PRODUCTION_PLAN_ADD_INPUT, baseId, 'missing', 'iron-ore', 60, 'package_receiver'],
            [E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-plate', 60, 'package_receiver'],
            [E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 0, 'package_receiver'],
            [E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', NaN, 'package_receiver'],
            [E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'missing', 60, 'package_receiver'],
            [E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 60, 'smelter'],
            [E.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, baseId, 'missing', baseId, 'missing'],
            [E.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, baseId, planId, 'missing', 'missing'],
            [E.PRODUCTION_PLAN_REMOVE_INPUT, baseId, planId, 'missing'],
            [E.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, 'missing'],
            [E.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, '', 'smelter:0'],
            [E.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, '', 'missing'],
            [E.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, baseId, 'missing', 'all'],
        ]);
        expect(view.value('base')).toEqual(before);
        await app.dispatch([E.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-ore', 60, 'package_receiver']);
        await app.dispatch([E.BASES_SET_MODE, 'advanced']);
        await app.dispatch([E.PRODUCTION_PLAN_DELETE_SECTION, baseId, planId]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_SET_NAME, 'Late edit']);
        expect(view.value('base')!.productions).toEqual([]);
        await app.dispatch([E.BASES_DELETE_BASE, baseId]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, true]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_SUBMIT]);
        await app.dispatch([E.BASES_SET_SELECTED_BASE, baseId]);
        await app.dispatch([E.PRODUCTION_PLAN_MODAL_OPEN]);
        expect(view.value('bases')).toEqual([]);
        expect(view.value('inputs').inputItems).toEqual([]);
    });

    it('leaves a plan with no usable recipe unprovisioned', async () => {
        const { app, view, baseId, createPlan } = await setup();
        const planId = await createPlan('removed-item');
        const before = view.value('base')!.buildings;
        await app.dispatch([E.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, baseId, planId, 'all']);
        expect(view.value('base')!.buildings).toEqual(before);
        expect(view.value('base')!.productions[0]).toMatchObject({ name: 'removed-item Production', requiredBuildings: [] });
    });
});
