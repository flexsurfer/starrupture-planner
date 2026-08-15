import { createUkladRuntime } from '@ukladjs/core/vanilla';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { describe, expect, it } from 'vitest';
import type { AppContracts } from '@/app/uklad/contracts';
import { appIds } from '@/app/uklad/catalog';
import { createAppState } from '@/app/uklad/initial-state';
import type { AppState } from '@/app/uklad/model';
import { registerBasesModule } from '@/features/bases/module';

const PERSIST_PREFIX = 'events-persistence-test';

function createState(): AppState {
    return {
        ...createAppState(),
        basesList: [{
            id: 'base-1',
            name: 'Base 1',
            coreLevel: 0,
            energyGroupId: 'group-1',
            buildings: [],
            productions: [],
        }],
        energyGroups: [{ id: 'group-1', name: 'Grid 1' }],
    };
}

function createRuntime(state = createState()) {
    const runtime = createUkladRuntime<AppContracts>({ initialState: state });
    runtime.registerModule(registerBasesModule);
    return runtime;
}

describe('base persistence', () => {
    it('persists a base after its energy-group assignment is removed', async () => {
        const storage = memoryStorageAdapter();
        const runtime = createRuntime();
        const persistence = persist(runtime, {
            storage,
            prefix: PERSIST_PREFIX,
            keys: ['basesList'],
        });
        persistence.hydrate();

        const harness = createUkladTestHarness(runtime);
        harness.dispatchSync([appIds.events.BASES_SET_ENERGY_GROUP, 'base-1', null]);
        await harness.flush();

        expect(harness.getState().basesList[0]).not.toHaveProperty('energyGroupId');
        expect(JSON.parse(storage.getItem(`${PERSIST_PREFIX}/basesList`) || '')).toEqual({
            v: 1,
            data: [{
                id: 'base-1',
                name: 'Base 1',
                coreLevel: 0,
                buildings: [],
                productions: [],
            }],
        });

        const rehydratedRuntime = createRuntime();
        const rehydratedPersistence = persist(rehydratedRuntime, {
            storage,
            prefix: PERSIST_PREFIX,
            keys: ['basesList'],
        });
        rehydratedPersistence.hydrate();

        expect(createUkladTestHarness(rehydratedRuntime).getState().basesList[0]).not.toHaveProperty('energyGroupId');

        runtime.dispose();
        rehydratedRuntime.dispose();
    });
});
