import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { extractionContext, snapshotFixture } from '@/features/saves/decoder/test-fixture';
import { savesStorageKey } from './saves-storage';
import { createSaveWorkspace } from '@/features/saves/workspace';

vi.mock('@ukladjs/devtools', () => ({ enableDevtools: vi.fn() }));

let app: typeof import('./bootstrap') | undefined;
afterEach(() => {
    app?.persistence.dispose();
    app?.runtime.dispose();
    app = undefined;
    vi.restoreAllMocks();
    localStorage.clear();
    vi.resetModules();
});
const key = savesStorageKey('starrupture-planner', stateKeys.savesWorkspaces);

it('hydrates in bootstrap and reports rejected localStorage writes without changing the stored snapshot', async () => {
    const workspace = createSaveWorkspace('one', 'Stored world', analyzeSave(snapshotFixture(), extractionContext));
    const stored = JSON.stringify({ v: 1, data: { one: workspace } });
    localStorage.setItem(key, stored);
    app = await import('./bootstrap');
    const harness = createUkladTestHarness(app.runtime);
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])?.name).toBe('Stored world');
    await harness.flush();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    app.runtime.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'New name']);
    await harness.flush();
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_STORAGE_ERROR])).toBe('write');
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])?.name).toBe('New name');
    expect(localStorage.getItem(key)).toBe(stored);
});

it('reports corrupt Saves data from bootstrap and preserves it', async () => {
    localStorage.setItem(key, '{broken');
    app = await import('./bootstrap');
    const harness = createUkladTestHarness(app.runtime);
    await harness.flush();
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_STORAGE_ERROR])).toBe('load');
    app.runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, 'new']);
    await harness.flush();
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_IMPORT]).phase).toBe('closed');
    expect(localStorage.getItem(key)).toBe('{broken');
    app.runtime.dispatch([appIds.events.UI_SET_LOCALE, 'de']);
    await harness.flush();
    expect(JSON.parse(localStorage.getItem(`starrupture-planner/${stateKeys.uiLocale}`)!).data).toBe('de');
});
