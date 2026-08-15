import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerProductionPlansModule } from './module';

describe('production-plans Uklad module', () => {
    it('activates, deactivates, and deletes a plan section', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerProductionPlansModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            basesList: [{
                id: 'base-1',
                name: 'Outpost',
                buildings: [],
                productions: [{
                    id: 'plan-1',
                    name: 'Iron Plates',
                    selectedItemId: 'iron-plate',
                    targetAmount: 60,
                    active: false,
                    status: 'inactive',
                }],
            }],
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, 'base-1', 'plan-1']);
        expect(harness.getState().basesList[0]?.productions[0]).toMatchObject({ active: true, status: 'active' });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, 'base-1', 'plan-1']);
        expect(harness.getState().basesList[0]?.productions[0]).toMatchObject({ active: false, status: 'inactive' });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_DELETE_SECTION, 'base-1', 'plan-1']);
        expect(harness.getState().basesList[0]?.productions).toEqual([]);

        runtime.dispose();
    });
});
