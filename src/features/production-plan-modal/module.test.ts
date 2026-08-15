import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerItemsModule } from '@/features/items/module';
import { registerProductionPlanModalModule } from './module';

describe('production-plan-modal Uklad module', () => {
    it('derives small modal view models from the canonical form root', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerProductionPlanModalModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            itemsList: [{ id: 'iron-plate', name: 'Iron Plate', type: 'processed' }],
            productionPlanModalState: {
                ...harness.getState().productionPlanModalState,
                isOpen: true,
                editSectionId: 'plan-1',
                name: 'Iron line',
                selectedItemId: 'iron-plate',
                targetAmount: 90,
                matchInputs: true,
            },
        });

        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE])).toEqual({ isOpen: true });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA])).toEqual({ isEditMode: true });
        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES])).toMatchObject({
            defaultName: 'Iron line',
            selectedItemName: 'Iron Plate',
            currentTargetAmount: 90,
            matchInputs: true,
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Renamed line']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, {
            corporationId: 'miners', level: 2,
        }]);
        expect(harness.getState().productionPlanModalState).toMatchObject({
            name: 'Renamed line',
            targetAmount: 90,
            selectedCorporationLevel: { corporationId: 'miners', level: 2 },
        });

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
        expect(harness.getState().productionPlanModalState).toMatchObject({ isOpen: false, name: '' });

        runtime.dispose();
    });
});
