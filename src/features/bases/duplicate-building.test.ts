import { createUkladTestHarness } from '@ukladjs/core/testing';
import { expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import type { Base } from '@/app/uklad/model';
import { registerBasesModule } from './module';

it('duplicates live receivers and plan dispatchers without stealing links or changing saved plans', () => {
    const runtime = createAppRuntime();
    runtime.registerModule(registerBasesModule);
    const harness = createUkladTestHarness(runtime);
    const input = {
        id: 'input', buildingTypeId: 'package_receiver', sectionType: 'inputs',
        name: 'Delivery', description: 'Keep this note', planningOwnerPlanId: 'consumer',
        selectedItemId: 'old-item', ratePerMinute: 10,
        linkedOutput: { baseId: 'source', buildingId: 'output', itemIdSnapshot: 'plate', ratePerMinuteSnapshot: 10 },
    };
    const bases: Base[] = [
        { id: 'source', name: 'Source', buildings: [{
            id: 'output', buildingTypeId: 'package_dispatcher', sectionType: 'outputs',
            sourceProductionId: 'producer', planningOwnerPlanId: 'producer',
            capacityPerMinute: 200, allocationMode: 'auto', priority: 1,
        }], productions: [{ id: 'producer', name: 'Producer', selectedItemId: 'plate', targetAmount: 180 }] },
        { id: 'target', name: 'Target', buildings: [input], productions: [{
            id: 'consumer', name: 'Consumer', selectedItemId: 'wire', targetAmount: 30, inputs: [input],
        }] },
    ];
    // The current supply differs from the saved manual fields and link snapshots.
    harness.restoreState({ ...harness.getState(), basesList: bases, buildingsList: [
        { id: 'package_receiver', name: 'Cargo Receiver', type: 'transport' },
        { id: 'package_dispatcher', name: 'Cargo Dispatcher', type: 'transport' },
    ] });
    const before = structuredClone(harness.getState().basesList);

    harness.dispatchSync([appIds.events.BASES_DUPLICATE_BUILDING, 'target', 'input', 'copy-input']);
    harness.dispatchSync([appIds.events.BASES_DUPLICATE_BUILDING, 'target', 'input', 'copy-input-2']);
    harness.dispatchSync([appIds.events.BASES_DUPLICATE_BUILDING, 'source', 'output', 'copy-output']);
    const [source, target] = harness.getState().basesList;
    expect(target.buildings[1]).toEqual({
        id: 'copy-input', buildingTypeId: 'package_receiver', sectionType: 'inputs',
        name: 'Delivery (2)', description: 'Keep this note', selectedItemId: 'plate', ratePerMinute: 180,
    });
    expect(target.buildings[2].name).toBe('Delivery (3)');
    expect(source.buildings[1]).toEqual({
        id: 'copy-output', buildingTypeId: 'package_dispatcher', sectionType: 'outputs',
        name: 'Cargo Dispatcher (2)', selectedItemId: 'plate', ratePerMinute: 180, capacityPerMinute: 200,
    });
    expect(source.buildings[0]).toEqual(before[0].buildings[0]);
    expect(target.buildings[0]).toEqual(before[1].buildings[0]);
    expect([source.productions, target.productions]).toEqual(before.map(base => base.productions));
    runtime.dispose();
});

it('copies manual logistics settings, but rejects unsupported buildings and reused IDs', () => {
    const runtime = createAppRuntime();
    runtime.registerModule(registerBasesModule);
    const harness = createUkladTestHarness(runtime);
    harness.restoreState({ ...harness.getState(), buildingsList: [
        { id: 'package_dispatcher', name: 'Cargo Dispatcher', type: 'transport' },
    ], basesList: [{ id: 'base', name: 'Base', productions: [], buildings: [
        { id: 'manual', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'wire', ratePerMinute: 120 },
        { id: 'storage', buildingTypeId: 'storage', sectionType: 'outputs' },
    ] }] });
    harness.dispatchSync([appIds.events.BASES_DUPLICATE_BUILDING, 'base', 'manual', 'copy']);
    expect(harness.getState().basesList[0].buildings[2]).toMatchObject({ selectedItemId: 'wire', ratePerMinute: 120 });
    const before = harness.getState();
    for (const [baseId, buildingId, id] of [['base', 'manual', 'copy'], ['base', 'storage', 'new'], ['missing', 'manual', 'new'], ['base', 'missing', 'new']]) {
        harness.dispatchSync([appIds.events.BASES_DUPLICATE_BUILDING, baseId, buildingId, id]);
    }
    expect(harness.getState().basesList).toEqual(before.basesList);
    runtime.dispose();
});
