import { createUkladTestHarness } from '@ukladjs/core/testing';
import { expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';

it.each(['planning', 'advanced'] as const)('adds and reverts diagram inputs in saved and edited plans (%s)', async mode => {
    const runtime = createAppRuntime();
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    harness.restoreState({ ...harness.getState(), basesMode: mode, basesSelectedBaseId: 'base',
        itemsList: ['ore', 'plate', 'product'].map(id => ({ id, name: id, type: id === 'ore' ? 'raw' : 'processed' })),
        buildingsList: [
            { id: 'storage_depot_v1', name: 'Storage v1', type: 'storage' },
            { id: 'smelter', name: 'Smelter', type: 'production', recipes: [
                { output: { id: 'plate', amount_per_minute: 20 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] },
            ] },
            { id: 'factory', name: 'Factory', type: 'production', recipes: [
                { output: { id: 'product', amount_per_minute: 10 }, inputs: [{ id: 'plate', amount_per_minute: 20 }] },
            ] },
        ],
        basesList: [{ id: 'base', name: 'Base', buildings: [], productions: [
            { id: 'plan', name: 'Plan', selectedItemId: 'product', targetAmount: 10, inputs: [], active: false },
        ] }],
    });
    const base = () => harness.getState().basesList[0];
    const plan = () => base().productions[0];
    const flow = () => harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, 'base', 'plan']);
    try {
        const originalFlow = flow();
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_INPUT, 'base', 'plan', 'product', 10, 'storage_depot_v1']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_INPUT, 'base', 'plan', 'plate', Infinity, 'storage_depot_v1']);
        expect(base().buildings).toEqual([]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_INPUT, 'base', 'plan', 'plate', 20, 'storage_depot_v1']);
        const inputId = base().buildings[0].id;
        expect(plan().inputs).toEqual([expect.objectContaining({ id: inputId, selectedItemId: 'plate', ratePerMinute: 20 })]);
        expect(plan().requiredBuildings).toEqual([{ buildingId: 'factory', count: 1 }]);
        expect(flow()?.rawMaterialDeficits).toEqual([]);
        expect(flow()?.nodes.some(node => node.buildingId === 'smelter')).toBe(false);
        expect(base().buildings[0].planningOwnerPlanId).toBe(mode === 'planning' ? 'plan' : undefined);

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_REMOVE_INPUT, 'base', 'plan', inputId]);
        expect(plan().inputs).toEqual([]);
        expect(base().buildings.some(input => input.id === inputId)).toBe(mode === 'advanced');
        expect(flow()).toEqual(originalFlow);

        // The editor shortcut uses the same add-buildings and toggle-input events as its toolbar.
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, 'plan']);
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'base', 'storage_depot_v1', 'inputs', 1,
            undefined, undefined, 'plate', 20]);
        const editorInputId = harness.getState().productionPlanModalState.selectedInputIds[0];
        expect(plan().inputs?.map(input => input.id)).toEqual([editorInputId]);
        expect(base().buildings.find(input => input.id === editorInputId)?.planningOwnerPlanId).toBe(mode === 'planning' ? 'plan' : undefined);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, editorInputId]);
        expect(plan().inputs).toEqual([]);
        expect(base().buildings.some(input => input.id === editorInputId)).toBe(mode === 'advanced');
        expect(flow()).toEqual(originalFlow);

        // Saved-diagram actions must keep an already-open editor in sync too.
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_INPUT, 'base', 'plan', 'plate', 20, 'storage_depot_v1']);
        const sharedId = harness.getState().productionPlanModalState.selectedInputIds[0];
        expect(plan().inputs?.map(input => input.id)).toEqual([sharedId]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_REMOVE_INPUT, 'base', 'plan', sharedId]);
        await harness.flush();
        expect(harness.getState().productionPlanModalState.selectedInputIds).toEqual([]);
        expect(flow()).toEqual(originalFlow);
    } finally { runtime.dispose(); }
});
