import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { createHeadlessEffects } from '@/platform/headless/effects';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { createArchive, type PlannerArchive } from './archive';
import { archiveFixture } from './test-fixture';

function setup() {
    const runtime = createAppRuntime();
    const exports: PlannerArchive[] = [];
    runtime.registerModule(registerApplicationModules);
    runtime.registerModule(createHeadlessEffects({ onExport: archive => exports.push(archive) }));
    const harness = createUkladTestHarness(runtime);
    return { runtime, harness, exports };
}

describe('archive events and persistence', () => {
    it('previews before import, cancels, then imports repeated copies without changing existing work', async () => {
        const { runtime, harness, exports } = setup();
        try {
            harness.restoreState(archiveFixture());
            harness.dispatchSync([appIds.events.DATA_TRANSFER_EXPORT, { baseIds: null, planIds: null }]);
            await harness.flush();
            expect(exports).toHaveLength(1);
            const text = JSON.stringify(exports[0]);
            harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, text]);
            await harness.flush();
            expect(harness.getState().basesList).toHaveLength(2);
            expect(harness.getSubscriptionValue([appIds.subscriptions.DATA_TRANSFER_PREVIEW])?.bases).toHaveLength(2);
            harness.dispatchSync([appIds.events.DATA_TRANSFER_CANCEL_IMPORT]);
            harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT]);
            expect(harness.getState().basesList).toHaveLength(2);
            for (let i = 0; i < 2; i++) {
                harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, text]);
                await harness.flush();
                harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT]);
            }
            const state = harness.getState();
            expect(state.basesList).toHaveLength(6);
            expect(state.plannerTabs).toHaveLength(6);
            expect(new Set(state.basesList.map(base => base.id)).size).toBe(6);
            expect(new Set(state.plannerTabs.map(plan => plan.id)).size).toBe(6);
            expect(state.basesList.slice(0, 2)).toEqual(archiveFixture().basesList);
            expect(state.plannerTabs.slice(0, 2)).toEqual(archiveFixture().plannerTabs);
            expect(state.dataTransferPreview).toBeNull();
            expect(state.dataTransferStatus?.kind).toBe('success');
        } finally { runtime.dispose(); }
    });

    it('imports only selected entries, detaches omitted bases, and appends Copy without changing the originals', async () => {
        const { runtime, harness } = setup();
        try {
            const original = archiveFixture();
            harness.restoreState(original);
            const archive = createArchive(original, { baseIds: null, planIds: null });
            harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify(archive)]);
            await harness.flush();
            const preview = harness.getState().dataTransferPreview!;
            harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, { baseIds: [], planIds: [] }]);
            expect(harness.getState().basesList).toHaveLength(2);
            expect(harness.getState().plannerTabs).toHaveLength(2);
            expect(harness.getState().dataTransferPreview).toEqual(preview);
            expect(harness.getState().dataTransferStatus?.kind).toBe('error');
            harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, {
                baseIds: [preview.bases[1].id], planIds: [preview.plans[1].id],
            }]);
            const state = harness.getState();
            expect(state.basesList.map(base => base.name)).toEqual(['Smelting', 'Assembly', 'Assembly Copy']);
            expect(state.plannerTabs.map(plan => plan.name)).toEqual(['Single plan', 'Multi plan', 'Multi plan Copy']);
            expect(state.basesList.slice(0, 2)).toEqual(original.basesList);
            expect(state.plannerTabs.slice(0, 2)).toEqual(original.plannerTabs);
            const imported = state.basesList[2];
            for (const input of [imported.buildings[0], imported.productions[0].inputs![0]]) {
                expect(input.linkedOutput).toBeUndefined();
                expect(input.selectedItemId).toBe('plate');
                expect(input.ratePerMinute).toBe(42);
            }
            expect(imported.energyGroupId).toBe(state.energyGroups[2].id);
            expect(preview.bases[1].name).toBe('Assembly');
            expect(preview.bases[1].buildings[0].linkedOutput).toBeDefined();
        } finally { runtime.dispose(); }
    });

    it('keeps links between selected bases and omits energy groups when importing only plans', async () => {
        const { runtime, harness } = setup();
        try {
            const archive = createArchive(archiveFixture(), { baseIds: null, planIds: null });
            harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify(archive)]);
            await harness.flush();
            const preview = harness.getState().dataTransferPreview!;
            harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, { baseIds: [], planIds: [preview.plans[0].id] }]);
            expect(harness.getState().energyGroups).toEqual([]);
            expect(harness.getState().basesList).toEqual([]);
            expect(harness.getState().plannerTabs.map(plan => plan.name)).toEqual(['Single plan Copy']);
            harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify(archive)]);
            await harness.flush();
            harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, { baseIds: null, planIds: [] }]);
            const [source, target] = harness.getState().basesList;
            expect(source.name).toBe('Smelting Copy');
            expect(target.name).toBe('Assembly Copy');
            expect(target.buildings[0].linkedOutput).toMatchObject({ baseId: source.id, buildingId: source.buildings[0].id });
            expect(harness.getState().energyGroups).toHaveLength(1);
            expect(harness.getState().plannerTabs).toHaveLength(1);
        } finally { runtime.dispose(); }
    });

    it('reports malformed files without partially importing or retaining an earlier preview', async () => {
        const { runtime, harness } = setup();
        try {
            const archive = createArchive(archiveFixture(), { baseIds: null, planIds: null });
            harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify(archive)]);
            await harness.flush();
            expect(harness.getState().dataTransferPreview).not.toBeNull();
            harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, '{broken']);
            await harness.flush();
            expect(harness.getState().dataTransferPreview).toBeNull();
            expect(harness.getState().dataTransferStatus?.kind).toBe('error');
            expect(harness.getState().basesList).toEqual([]);
            expect(harness.getState().plannerTabs).toEqual([]);
        } finally { runtime.dispose(); }
    });

    it('persists imported data and trimmed plan names across a fresh runtime', async () => {
        const storage = memoryStorageAdapter();
        const { runtime, harness } = setup();
        persist(runtime, { storage, keys: PERSIST_KEYS }).hydrate();
        const archive = createArchive(archiveFixture(), { baseIds: null, planIds: null });
        harness.dispatchSync([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, JSON.stringify(archive)]);
        await harness.flush();
        harness.dispatchSync([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT]);
        const id = harness.getState().plannerTabs[0].id;
        harness.dispatchSync([appIds.events.PLANNER_RENAME_TAB, id, '   Renamed plan   ']);
        harness.dispatchSync([appIds.events.PLANNER_RENAME_TAB, id, '  ']);
        harness.dispatchSync([appIds.events.PLANNER_RENAME_TAB, 'missing', 'Wrong plan']);
        await harness.flush();
        const expected = harness.getState();
        runtime.dispose();
        const restored = setup();
        try {
            persist(restored.runtime, { storage, keys: PERSIST_KEYS }).hydrate();
            const state = restored.harness.getState();
            expect(state.plannerTabs[0].name).toBe('Renamed plan');
            expect(state.plannerTabs[1].name).toBe('Multi plan Copy');
            expect(state.basesList).toEqual(expected.basesList);
            expect(state.energyGroups).toEqual(expected.energyGroups);
            expect(state.plannerTabs).toEqual(expected.plannerTabs);
            expect(state.plannerActiveTabId).toBe(id);
            expect(state.basesMode).toBe('advanced');
            expect(state.dataTransferPreview).toBeNull();
            expect(state.dataTransferStatus).toBeNull();
        } finally { restored.runtime.dispose(); }
    });
});
