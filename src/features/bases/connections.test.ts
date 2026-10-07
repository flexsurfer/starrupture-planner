import { afterEach, describe, expect, it } from 'vitest';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import type { Base, BaseBuilding, Building } from '@/app/uklad/model';

const buildingTypes: Building[] = [
    { id: 'package_dispatcher', name: 'Dispatcher', type: 'logistics' },
    { id: 'package_receiver', name: 'Receiver', type: 'logistics' },
    { id: 'storage_v1', name: 'Storage v1', type: 'storage' },
    { id: 'storage_v2', name: 'Storage v2', type: 'storage' },
    { id: 'multistorage', name: 'Multistorage', type: 'storage' },
    { id: 'expandable_storage', name: 'Expandable Storage', type: 'storage' },
    { id: 'drone_rail', name: 'Drone Rail', type: 'logistics' },
    { id: 'drone_merger_3_to_1', name: 'Drone Merger', type: 'logistics' },
];
const storageTypes = ['storage_v1', 'storage_v2', 'multistorage', 'expandable_storage'] as const;
const droneTypes = ['drone_rail', 'drone_merger_3_to_1'] as const;
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => { runtimes.splice(0).forEach(runtime => runtime.dispose()); });

function setup(mode: 'planning' | 'advanced', outputType = 'package_dispatcher', inputType = 'package_receiver', occupied = false) {
    const runtime = createAppRuntime();
    runtime.registerModule(registerApplicationModules);
    runtimes.push(runtime);
    const harness = createUkladTestHarness(runtime);
    const input: BaseBuilding = { id: 'input', buildingTypeId: inputType, sectionType: 'inputs', name: 'North dock', selectedItemId: 'plate', ratePerMinute: 60, planningOwnerPlanId: 'plan' };
    if (occupied) input.linkedOutput = { baseId: 'source', buildingId: 'output', itemIdSnapshot: 'plate', ratePerMinuteSnapshot: 60 };
    const bases: Base[] = [
        { id: 'source', name: 'Source', productions: [], buildings: [
            { id: 'output', name: 'Plate supply', buildingTypeId: outputType, sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'other-output', buildingTypeId: outputType, sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
        ] },
        { id: 'target', name: 'Target', buildings: [input,
            { id: 'other-input', buildingTypeId: inputType, sectionType: 'inputs' }], productions: [
            { id: 'plan', name: 'Consumer', selectedItemId: 'product', targetAmount: 60, inputs: occupied ? [{ ...input }] : [] },
        ] },
    ];
    harness.restoreState({ ...harness.getState(), basesMode: mode, basesSelectedBaseId: 'target', buildingsList: buildingTypes,
        itemsList: [{ id: 'plate', name: 'Plate', type: 'component' }, { id: 'product', name: 'Product', type: 'component' }], basesList: bases });
    return harness;
}

describe.each(['advanced', 'planning'] as const)('%s connection rules', mode => {
    it('disconnects the confirmed pair into unconfigured manual mode while preserving plan snapshots', () => {
        const harness = setup(mode, undefined, undefined, true);
        const plans = harness.getState().basesList[1].productions;
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'source', 'output', 'plate', 90]);
        harness.dispatchSync([appIds.events.BASES_DISCONNECT_CONNECTIONS, [
            { source: { baseId: 'source', buildingId: 'output' }, target: { baseId: 'target', buildingId: 'input' } },
        ]]);
        const input = harness.getState().basesList[1].buildings[0];
        expect(input.selectedItemId).toBeUndefined();
        expect(input.ratePerMinute).toBeUndefined();
        expect(input.linkedOutput).toBeUndefined();
        expect(input.planningOwnerPlanId).toBeUndefined();
        expect(harness.getState().basesList[1].productions).toEqual(plans);
    });

    it('ignores a stale disconnect after an input has moved to a different source', () => {
        const harness = setup(mode, undefined, undefined, true);
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'target', 'input', 'plate', 60]);
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'input', 'source', 'other-output']);
        const before = harness.getState();
        harness.dispatchSync([appIds.events.BASES_DISCONNECT_CONNECTIONS, [
            { source: { baseId: 'source', buildingId: 'output' }, target: { baseId: 'target', buildingId: 'input' } },
            { source: { baseId: 'source', buildingId: 'output' }, target: { baseId: 'missing', buildingId: 'input' } },
        ]]);
        expect(harness.getState()).toEqual(before);
    });

    it.each([
        ['package_dispatcher', 'package_receiver', true],
        ...storageTypes.flatMap(outputType => storageTypes.map(inputType => [outputType, inputType, true] as const)),
        ...droneTypes.flatMap(outputType => droneTypes.map(inputType => [outputType, inputType, true] as const)),
        ['package_dispatcher', 'storage_v1', false],
        ['storage_v1', 'package_receiver', false],
        ['drone_rail', 'storage_v1', false],
        ['storage_v1', 'drone_merger_3_to_1', false],
        ['package_dispatcher', 'drone_rail', false],
        ['drone_merger_3_to_1', 'package_receiver', false],
        ['package_receiver', 'package_dispatcher', false],
    ] as const)('enforces %s → %s (%s)', (outputType, inputType, allowed) => {
        const harness = setup(mode, outputType, inputType);
        const before = harness.getState();
        const outputs = harness.getSubscriptionValue([appIds.subscriptions.BASES_CONNECTION_OUTPUTS, 'target', inputType]);
        expect(outputs.map(output => output.baseBuildingId).sort()).toEqual(allowed ? ['other-output', 'output'] : []);
        const inputs = harness.getSubscriptionValue([appIds.subscriptions.BASES_CONNECTION_INPUTS, 'source', 'output', outputType]);
        expect(inputs.map(input => input.buildingId).sort()).toEqual(allowed ? ['input', 'other-input'] : []);
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'input', 'source', 'output']);
        if (allowed) {
            expect(harness.getState().basesList[1].buildings[0].linkedOutput).toMatchObject({ baseId: 'source', buildingId: 'output', itemIdSnapshot: 'plate', ratePerMinuteSnapshot: 60 });
        } else expect(harness.getState()).toEqual(before);
    });

    it('requires an explicit disconnect before either end can be reassigned', () => {
        const harness = setup(mode, undefined, undefined, true);
        const before = harness.getState();
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'other-input', 'source', 'output']);
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'input', 'source', 'other-output']);
        expect(harness.getState()).toEqual(before);

        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'target', 'input', 'plate', 60]);
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'other-input', 'source', 'output']);
        expect(harness.getState().basesList[1].buildings[0].linkedOutput).toBeUndefined();
        expect(harness.getState().basesList[1].buildings[1].linkedOutput).toMatchObject({ baseId: 'source', buildingId: 'output' });
        // Disconnecting a physical endpoint preserves saved plan snapshots.
        expect(harness.getState().basesList[1].productions).toEqual(before.basesList[1].productions);
    });

    it('rejects occupied endpoints in both add-building directions without creating a partial building', () => {
        const harness = setup(mode, undefined, undefined, true);
        const before = harness.getState();
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'target', 'package_receiver', 'inputs', 1,
            undefined, undefined, 'plate', 60, { baseId: 'source', buildingId: 'output' }]);
        expect(harness.getState()).toEqual(before);
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'source', 'package_dispatcher', 'outputs', 1,
            undefined, undefined, 'plate', 60, null, null, null, null, null, null, { baseId: 'target', buildingId: 'input' }]);
        expect(harness.getState()).toEqual(before);
    });

    it('rejects incompatible add-building links and multiple inputs claiming one output', () => {
        const harness = setup(mode);
        const before = harness.getState();
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'target', 'storage_v1', 'inputs', 1,
            undefined, undefined, 'plate', 60, { baseId: 'source', buildingId: 'output' }]);
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'source', 'storage_v1', 'outputs', 1,
            undefined, undefined, 'plate', 60, null, null, null, null, null, null, { baseId: 'target', buildingId: 'input' }]);
        expect(harness.getState()).toEqual(before);
        const storage = setup(mode, 'storage_v1', 'storage_v1');
        const storageBefore = storage.getState();
        storage.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'target', 'storage_v1', 'inputs', 2,
            undefined, undefined, 'plate', 60, { baseId: 'source', buildingId: 'output' }]);
        expect(storage.getState()).toEqual(storageBefore);
    });

    it.each(['saved', 'editor'] as const)('protects occupied outputs in the %s plan workflow', workflow => {
        const harness = setup(mode, undefined, undefined, true);
        harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'Another target']);
        const targetBaseId = harness.getState().basesSelectedBaseId!;
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        // Advanced mode supports an unsaved plan; Planning mode requires a saved target plan.
        const state = harness.getState();
        harness.restoreState({ ...state, basesList: state.basesList.map(base => base.id !== targetBaseId ? base : {
            ...base, productions: [{ id: 'other-plan', name: 'Other consumer', selectedItemId: 'product', targetAmount: 60 }],
        }) });
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, 'other-plan']);
        const before = harness.getState();
        if (workflow === 'saved') harness.dispatchSync([appIds.events.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, targetBaseId, 'other-plan', 'source', 'output']);
        else harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, 'source', 'output']);
        expect(harness.getState()).toEqual(before);
    });

    it.each((['saved', 'editor'] as const).flatMap(workflow =>
        ['storage_v2', ...droneTypes].map(outputType => [workflow, outputType] as const),
    ))('creates a matching input in the %s plan workflow for %s', (workflow, outputType) => {
        const harness = setup(mode, outputType, outputType);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, 'plan']);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, 'target', 'plan', 'plate'])).toHaveLength(2);
        const before = harness.getState();
        if (workflow === 'saved') harness.dispatchSync([appIds.events.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, 'target', 'plan', 'source', 'output', 'package_receiver']);
        else harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, 'source', 'output', 'package_receiver']);
        expect(harness.getState()).toEqual(before);
        if (workflow === 'saved') harness.dispatchSync([appIds.events.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, 'target', 'plan', 'source', 'output']);
        else harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, 'source', 'output']);
        expect(harness.getState().basesList[1].buildings).toContainEqual(expect.objectContaining({
            buildingTypeId: outputType, linkedOutput: expect.objectContaining({ baseId: 'source', buildingId: 'output' }),
        }));
    });
});

it('shares compatible choices and current connection details between subscriptions', () => {
    const harness = setup('advanced', undefined, undefined, true);
    const outputQuery: [typeof appIds.subscriptions.BASES_CONNECTION_OUTPUTS, string, string] = [appIds.subscriptions.BASES_CONNECTION_OUTPUTS, 'target', 'package_receiver'];
    expect(harness.getSubscriptionValue(outputQuery)[0].connections).toEqual([
        { baseId: 'target', buildingId: 'input', baseName: 'Target', buildingName: 'North dock',
            building: buildingTypes[1], item: { id: 'plate', name: 'plate', type: 'unknown' }, ratePerMinute: 60 },
    ]);
    expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_CONNECTION_OUTPUTS, 'target', 'storage_v1'])).toEqual([]);
    const inputs = harness.getSubscriptionValue([appIds.subscriptions.BASES_CONNECTION_INPUTS, 'source', 'other-output', 'package_dispatcher']);
    expect(inputs[0].connections).toEqual([{ baseId: 'source', buildingId: 'output', baseName: 'Source', buildingName: 'Plate supply',
        building: buildingTypes[0], item: { id: 'plate', name: 'plate', type: 'unknown' }, ratePerMinute: 60 }]);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, 'target', 'plan', 'plate'])[0].connections).toEqual(harness.getSubscriptionValue(outputQuery)[0].connections);
    harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'target', 'input', 'plate', 60]);
    expect(harness.getSubscriptionValue(outputQuery).every(output => output.connections.length === 0)).toBe(true);
});
