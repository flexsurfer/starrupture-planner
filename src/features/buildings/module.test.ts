import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerCorporationsModule } from '@/features/corporations/module';
import { registerItemsModule } from '@/features/items/module';
import { registerBuildingsModule } from './module';

describe('buildings Uklad module', () => {
    it('owns building roots and keeps upgrades adjacent in the production list', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerCorporationsModule);
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            buildingsList: [
                { id: 'assembler', name: 'Assembler', type: 'production', upgrade: 'assembler-v2' },
                { id: 'assembler-v2', name: 'Assembler V2', type: 'production' },
            ],
        });

        expect(harness.getSubscriptionValue([appIds.subscriptions.BUILDINGS_BY_ID_MAP])).toMatchObject({
            assembler: { name: 'Assembler' },
        });
        expect(harness.getSubscriptionValue([appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST]))
            .toMatchObject([{ id: 'assembler' }, { id: 'assembler-v2' }]);

        runtime.dispose();
    });
});
