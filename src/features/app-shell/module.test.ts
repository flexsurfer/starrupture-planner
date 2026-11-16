import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerAppShellModule } from './module';

describe('app shell Uklad module', () => {
    it('announces an update without reloading until the user requests it', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerAppShellModule);
        const reload = vi.fn();
        runtime.registerModule(registrar => { registrar.regEffect(appIds.effects.reloadForUpdate, reload); });
        const harness = createUkladTestHarness(runtime);
        harness.dispatchSync([appIds.events.APP_RELOAD_FOR_UPDATE]);
        expect(reload).not.toHaveBeenCalled();
        harness.dispatchSync([appIds.events.APP_UPDATE_AVAILABLE, '2026.11.16-130000']);
        expect(harness.getSubscriptionValue([appIds.subscriptions.APP_AVAILABLE_VERSION])).toBe('2026.11.16-130000');
        expect(reload).not.toHaveBeenCalled();
        harness.dispatchSync([appIds.events.APP_RELOAD_FOR_UPDATE]);
        expect(reload).toHaveBeenCalledOnce();
        expect(reload.mock.calls[0][0]).toBe('2026.11.16-130000');
        harness.dispatchSync([appIds.events.APP_UPDATE_AVAILABLE, null]);
        expect(harness.getSubscriptionValue([appIds.subscriptions.APP_AVAILABLE_VERSION])).toBeNull();
        runtime.dispose();
    });

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
