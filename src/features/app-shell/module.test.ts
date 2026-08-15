import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerAppShellModule } from './module';

describe('app shell Uklad module', () => {
    it('loads versioned game data and exposes its typed root subscription', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerAppShellModule);
        const harness = createUkladTestHarness(runtime);

        harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', {
            items: [{ id: 'iron-ore', name: 'Iron Ore', type: 'raw' }],
            buildings: [],
            corporations: {
                miners: { id: 'miners', levels: [] },
            },
        }]);

        expect(harness.getSubscriptionValue([appIds.subscriptions.APP_DATA_VERSION])).toBe('playtest');
        expect(harness.getState().itemsById['iron-ore']).toEqual({
            id: 'iron-ore',
            name: 'Iron Ore',
            type: 'raw',
        });
        expect(harness.getState().corporationsList).toMatchObject([{ id: 'miners', name: 'miners' }]);

        runtime.dispose();
    });
});
