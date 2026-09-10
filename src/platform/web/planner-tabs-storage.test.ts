import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { describe, expect, it } from 'vitest';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { TEST_GAME_DATA } from '@/platform/headless/e2e-support';
import { createPlannerTab } from '@/features/planner/state';
import { PERSIST_KEYS } from './persistence';

function createSavedRuntime(storage: ReturnType<typeof memoryStorageAdapter>) {
    const runtime = createAppRuntime();
    runtime.registerModule(registerApplicationModules);
    persist(runtime, { storage, prefix: 'tabs-test', keys: PERSIST_KEYS }).hydrate();
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(TEST_GAME_DATA)]);
    return { runtime, harness };
}

describe('saved planner tabs', () => {
    it('restores every tab setting and the active tab across restarts, including edits made without switching tabs', async () => {
        const storage = memoryStorageAdapter();
        const first = createSavedRuntime(storage);
        const { harness } = first;
        harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'iron-plate', { corporationId: 'miners', level: 1 }]);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'iron', 'Iron', 'single']);
        harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 125]);
        harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter_mk2:0']);
        harness.dispatchSync([appIds.events.PLANNER_SET_FLOW_DIRECTION, 'TB']);
        harness.dispatchSync([appIds.events.PLANNER_SET_GROUP_BY_STAGE, true]);
        harness.dispatchSync([appIds.events.PLANNER_SET_ACTIVE_VIEW, 'table']);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'multi', 'Shared', 'multi']);
        harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
        harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'copper-wire']);
        harness.dispatchSync([appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'copper-wire', 75]);
        harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter_mk2:0']);
        harness.dispatchSync([appIds.events.PLANNER_SET_FLOW_DIRECTION, 'RL']);
        const expectedTabs = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS]);
        await harness.flush();
        first.runtime.dispose();

        const second = createSavedRuntime(storage);
        expect(second.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toEqual(expectedTabs);
        expect(second.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB_ID])).toBe('multi');
        expect(second.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])).toEqual(expectedTabs[1]);
        second.harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'iron']);
        expect(second.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])).toEqual(expectedTabs[0]);
        await second.harness.flush();
        second.runtime.dispose();

        const third = createSavedRuntime(storage);
        expect(third.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB_ID])).toBe('iron');
        third.harness.dispatchSync([appIds.events.PLANNER_CLOSE_TAB, 'iron']);
        await third.harness.flush();
        third.runtime.dispose();
        const fourth = createSavedRuntime(storage);
        expect(fourth.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toEqual([expectedTabs[1]]);
        fourth.harness.dispatchSync([appIds.events.PLANNER_CLOSE_TAB, 'multi']);
        await fourth.harness.flush();
        fourth.runtime.dispose();
        const empty = createSavedRuntime(storage);
        expect(empty.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toEqual([]);
        expect(empty.harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])).toBeNull();
        empty.runtime.dispose();
    });

    it('repairs malformed saved settings and recovers a stale active ID without losing valid tabs', () => {
        const tab = createPlannerTab('valid', '  Saved plan  ', 'multi');
        const storage = memoryStorageAdapter({
            [`tabs-test/${stateKeys.plannerTabs}`]: JSON.stringify({ v: 1, data: [
                { ...tab, targetAmount: -20, activeView: 'bad', flowDirection: 'bad',
                    multiTargets: [{ itemId: 'iron-plate', amount: 20 }, { itemId: 'iron-plate', amount: 30 }, { itemId: 'broken', amount: null }],
                    recipeSelections: { 'iron-plate': 'smelter:0', broken: 5 }, selectedCorporationLevel: { corporationId: 5, level: '1' } },
                tab, { ...tab, id: 'blank', name: '  ' }, { ...tab, id: 'bad-mode', mode: 'other' }, null,
            ] }),
            [`tabs-test/${stateKeys.plannerActiveTabId}`]: JSON.stringify({ v: 1, data: 'missing' }),
        });
        const { runtime, harness } = createSavedRuntime(storage);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toEqual([{
            ...tab, name: 'Saved plan', multiTargets: [{ itemId: 'iron-plate', amount: 20 }], recipeSelections: { 'iron-plate': 'smelter:0' },
        }]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])?.id).toBe('valid');
        runtime.dispose();
    });
});
