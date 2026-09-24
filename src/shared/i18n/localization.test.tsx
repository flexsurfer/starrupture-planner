import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { afterEach, expect, it } from 'vitest';
import { createAppRuntime } from '@/app/uklad/runtime';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { registerApplicationModules } from '@/app/uklad/register';
import { UkladProvider } from '@/app/uklad/bindings';
import { AppLocalization } from '@/features/app-shell/ui/AppLocalization';
import { GlobalSettings } from '@/features/data-transfer/ui/GlobalSettings';
import { TransferNotification } from '@/features/data-transfer/ui/TransferNotification';
import { ExternalInputModal } from '@/features/planner/ui/visualization/ExternalInputModal';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { message } from './core';
import { locales } from './locales';

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
const registeredGerman = locales.de;
afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
    if (registeredGerman) locales.de = registeredGerman;
    else delete locales.de;
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('dir');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('switches visible and stored messages, preserves game names, and restores the language on reload', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    const storage = memoryStorageAdapter();
    const persistence = persist(runtime, { storage, prefix: 'locale-test', keys: PERSIST_KEYS });
    persistence.hydrate();
    const originalItems = harness.getState().itemsList;
    const originalVersion = harness.getState().appDataVersion;
    harness.dispatchSync([appIds.events.DATA_TRANSFER_SET_STATUS, { kind: 'success', message: message('Export downloaded.') }]);
    const gameName = 'Wolfram Ore {count} <b>Core</b>';
    render(<UkladProvider runtime={runtime}><AppLocalization>
        <GlobalSettings onClose={() => {}} />
        <ExternalInputModal item={{ id: 'ore', name: gameName, type: 'raw' }} initialAmount={2} onClose={() => {}} onConfirm={() => {}} />
        <TransferNotification />
    </AppLocalization></UkladProvider>);

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'de' } });
    await screen.findByRole('heading', { name: 'Globale Einstellungen' });
    expect(screen.getByRole('dialog', { name: 'Externe Ressource verwenden' })).toBeVisible();
    expect(screen.getAllByText('Export heruntergeladen.')).toHaveLength(2);
    expect(screen.getByText(gameName)).toBeVisible();
    expect(document.querySelector('b')).toBeNull();
    expect(document.documentElement).toHaveAttribute('lang', 'de');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(harness.getState().itemsList).toBe(originalItems);
    expect(harness.getState().appDataVersion).toBe(originalVersion);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_LOCALE])).toBe('de'));

    cleanup();
    persistence.dispose();
    const reloaded = createAppRuntime();
    runtimes.push(reloaded);
    reloaded.registerModule(registerApplicationModules);
    const restored = persist(reloaded, { storage, prefix: 'locale-test', keys: PERSIST_KEYS });
    restored.hydrate();
    const next = createUkladTestHarness(reloaded);
    expect(next.getSubscriptionValue([appIds.subscriptions.UI_LOCALE])).toBe('de');
    restored.dispose();

    // An unavailable/removed locale must not break hydration.
    delete locales.de;
    const fallback = createAppRuntime();
    runtimes.push(fallback);
    fallback.registerModule(registerApplicationModules);
    const fallbackPersistence = persist(fallback, { storage, prefix: 'locale-test', keys: PERSIST_KEYS });
    fallbackPersistence.hydrate();
    const fallbackHarness = createUkladTestHarness(fallback);
    expect(fallbackHarness.getState()[stateKeys.uiLocale]).toBe('en');
    await act(async () => { fallback.dispatch([appIds.events.UI_SET_LOCALE, 'constructor']); });
    expect(fallbackHarness.getState().uiLocale).toBe('en');
    fallbackPersistence.dispose();
});
