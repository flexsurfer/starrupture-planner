import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerPlannerModule } from './module';

describe('planner Uklad module', () => {
    it('sets planner state and its default target rate through typed events', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerPlannerModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            buildingsList: [{
                id: 'assembler',
                name: 'Assembler',
                recipes: [{
                    output: { id: 'iron-plate', amount_per_minute: 45 },
                    inputs: [],
                }],
            }],
        });

        harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'iron-plate']);

        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_SELECTED_ITEM_ID])).toBe('iron-plate');
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TARGET_AMOUNT])).toBe(45);
        expect(harness.getState().uiActiveTab).toBe('planner');

        runtime.dispose();
    });
});
