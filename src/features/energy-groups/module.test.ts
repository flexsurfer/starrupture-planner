import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBasesModule } from '@/features/bases/module';
import { registerEnergyGroupsModule } from './module';

describe('energy-groups Uklad module', () => {
    it('normalizes group names and detaches deleted groups from their bases', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        runtime.registerModule(registerEnergyGroupsModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            basesList: [{ id: 'base-1', name: 'Outpost', buildings: [], productions: [] }],
        });

        harness.dispatchSync([appIds.events.ENERGY_GROUP_CREATE, '  Main   Grid ', 'base-1']);
        const [group] = harness.getSubscriptionValue([appIds.subscriptions.ENERGY_GROUPS_LIST]);

        expect(group).toMatchObject({ name: 'Main Grid' });
        expect(harness.getState().basesList[0]?.energyGroupId).toBe(group.id);

        harness.dispatchSync([appIds.events.ENERGY_GROUP_DELETE, group.id]);

        expect(harness.getSubscriptionValue([appIds.subscriptions.ENERGY_GROUPS_LIST])).toEqual([]);
        expect(harness.getState().basesList[0]?.energyGroupId).toBeUndefined();

        runtime.dispose();
    });
});
