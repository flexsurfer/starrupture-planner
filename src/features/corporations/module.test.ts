import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerCorporationsModule } from './module';

describe('corporations Uklad module', () => {
    it('derives corporation statistics from the canonical game-data root', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerCorporationsModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            corporationsList: [{
                id: 'miners',
                name: 'Miners',
                levels: [{
                    level: 2,
                    xp: 500,
                    components: [{ id: 'iron-ore', points: 2 }],
                    rewards: [],
                }],
            }],
        });

        expect(harness.getSubscriptionValue([appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS])).toMatchObject([{
            name: 'Miners',
            stats: { totalLevels: 1, totalComponents: 1, totalCost: 500 },
        }]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.CORPORATIONS_STATS_SUMMARY])).toEqual({
            totalCorporations: 1,
            totalLevels: 1,
            totalCost: 500,
        });

        runtime.dispose();
    });
});
