import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, expect, it, vi } from 'vitest';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import App from '@/App';
import { AppProviders } from '../AppProviders';
import { appIds } from '@/app/uklad/catalog';
import { runtime } from '@/platform/web/bootstrap';
import { loadGameDataVersion } from '@/platform/web/game-data-loader';

vi.mock('@ukladjs/devtools', () => ({ enableDevtools: vi.fn() }));
vi.mock('@/platform/web/game-data-loader', async importOriginal => ({
    ...await importOriginal<typeof import('@/platform/web/game-data-loader')>(),
    loadGameDataVersion: vi.fn(async () => ({ items: [], buildings: [], corporations: {} })),
}));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

afterAll(() => { cleanup(); runtime.dispose(); vi.unstubAllGlobals(); });

it('opens tools directly and preserves URL, runtime and language across navigation and remounts', async () => {
    window.history.replaceState(null, '', '/');
    const harness = createUkladTestHarness(runtime);
    render(<AppProviders><App /></AppProviders>);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('planner'));
    expect(window.location.pathname).toBe('/planner/');
    await waitFor(() => expect(loadGameDataVersion).toHaveBeenCalledTimes(1));
    expect(document.querySelector('a[href="/planner/"]')).not.toBeNull();
    expect(document.querySelector('[data-seo]')).toBeNull();

    const historyLength = window.history.length;
    fireEvent.click(screen.getAllByRole('link', { name: 'Items' })[0]);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('items'));
    expect(window.location.pathname).toBe('/items/');
    expect(window.history.length).toBe(historyLength + 1);
    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/planner/'));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('planner'));

    act(() => harness.dispatchSync([appIds.events.UI_SET_ACTIVE_TAB, 'recipes']));
    await waitFor(() => expect(window.location.pathname).toBe('/recipes/'));
    act(() => {
        harness.dispatchSync([appIds.events.UI_SET_THEME, 'light']);
        window.history.pushState(null, '', '/missing');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Open Planner' }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('planner'));
    expect(loadGameDataVersion).toHaveBeenCalledTimes(1);
    expect(harness.getSubscriptionValue([appIds.subscriptions.UI_THEME])).toBe('light');

    await act(async () => { runtime.dispatch([appIds.events.UI_SET_LOCALE, 'de']); });
    await waitFor(() => expect(document.documentElement.lang).toBe('de'));
    expect(window.location.pathname).toBe('/planner/');
});
