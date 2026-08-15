import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerHeadlessApplication } from './register';

describe('headless Uklad platform adapters', () => {
    const runtimes: ReturnType<typeof createAppRuntime>[] = [];

    afterEach(() => {
        runtimes.splice(0).forEach((runtime) => runtime.dispose());
    });

    it('loads bundled game data through APP_INIT without browser APIs', async () => {
        const runtime = createAppRuntime({ runtimeId: 'headless-effects-test' });
        runtimes.push(runtime);
        registerHeadlessApplication(runtime);
        const harness = createUkladTestHarness(runtime);

        harness.dispatchSync([appIds.events.APP_INIT]);

        await vi.waitFor(() => {
            expect(harness.getState().itemsList.length).toBeGreaterThan(0);
            expect(harness.getState().buildingsList.length).toBeGreaterThan(0);
            expect(harness.getState().uiGameDataLoadPending).toBe(false);
        });
    });
});
