import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBasesModule } from './module';

describe('bases Uklad module', () => {
    it('owns base selection, editing, and collapsed-card state', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBasesModule);
        const harness = createUkladTestHarness(runtime);

        harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'Outpost One']);
        const [base] = harness.getSubscriptionValue([appIds.subscriptions.BASES_LIST]);

        expect(base).toMatchObject({ name: 'Outpost One', buildings: [], productions: [] });
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_SELECTED_BASE_ID])).toBe(base.id);
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_SELECTED_BASE])).toMatchObject({ id: base.id });
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_BASE_BY_ID, base.id])).toMatchObject({ name: 'Outpost One' });

        harness.dispatchSync([appIds.events.BASES_SET_CORE_LEVEL, 3]);
        harness.dispatchSync([appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED, base.id, 'productionPlans']);

        expect(harness.getState().basesList[0]?.coreLevel).toBe(3);
        expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS])).toEqual({
            [base.id]: { productionPlans: true },
        });

        runtime.dispose();
    });
});
