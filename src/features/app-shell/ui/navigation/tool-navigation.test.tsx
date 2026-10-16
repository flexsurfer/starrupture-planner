import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, expect, it, vi } from 'vitest';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import App from '@/App';
import { AppProviders } from '../AppProviders';
import { appIds } from '@/app/uklad/catalog';
import { persistence, runtime } from '@/platform/web/bootstrap';
import { loadGameDataVersion } from '@/platform/web/game-data-loader';

vi.mock('@ukladjs/devtools', () => ({ enableDevtools: vi.fn() }));
vi.mock('@/platform/web/game-data-loader', async importOriginal => ({
    ...await importOriginal<typeof import('@/platform/web/game-data-loader')>(),
    loadGameDataVersion: vi.fn(async () => ({ items: [], buildings: [], corporations: {} })),
}));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

afterAll(() => { cleanup(); sessionStorage.clear(); persistence.dispose(); runtime.dispose(); vi.unstubAllGlobals(); });

it('opens tools directly and preserves URL, runtime and language across navigation and remounts', async () => {
    window.history.replaceState(null, '', '/');
    const harness = createUkladTestHarness(runtime);
    render(<AppProviders><App /></AppProviders>);
    // The initial route loads lazily; allow for module loading in the full suite.
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('planner'), { timeout: 5000 });
    expect(window.location.pathname).toBe('/planner/');
    await waitFor(() => expect(loadGameDataVersion).toHaveBeenCalledTimes(1));
    expect(document.querySelector('a[href="/planner/"]')).not.toBeNull();
    expect(document.querySelector('[data-seo]')).toBeNull();
    expect(screen.queryByText('My Bases')).not.toBeInTheDocument();

    const historyLength = window.history.length;
    fireEvent.click(screen.getAllByRole('link', { name: 'Factory Map' })[0]);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('mysaves'));
    expect(window.location.pathname).toBe('/map/');
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

    act(() => harness.dispatchSync([appIds.events.BASES_SET_MODE, 'planning']));
    expect(screen.queryByText('My Bases')).not.toBeInTheDocument();
    act(() => harness.dispatchSync([appIds.events.BASES_CREATE_BASE, 'Existing base']));
    expect(screen.getAllByText('My Bases')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('link', { name: 'My Bases' })[0]);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('mybases'));
    const notice = screen.getByRole('note');
    expect(notice).toHaveTextContent('My Bases is deprecated and will not be supported in future versions. Use Factory Map instead.');
    fireEvent.click(within(notice).getByRole('button', { name: 'Hide this notice for this session' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('link', { name: 'Factory Map' })[0]);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('mysaves'));
    expect(window.location.pathname).toBe('/map/');
    expect(await screen.findByRole('heading', { name: 'Import your first save' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose save file' })).toBeEnabled();

    fireEvent.click(screen.getAllByRole('link', { name: 'My Bases' })[0]);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('mybases'));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('link', { name: 'Factory Map' })[0]);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.UI_ACTIVE_TAB])).toBe('mysaves'));

    await act(async () => { runtime.dispatch([appIds.events.UI_SET_LOCALE, 'de']); });
    await waitFor(() => expect(document.documentElement.lang).toBe('de'));
    expect((await screen.findAllByRole('link', { name: 'Fabrikkarte' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Meine Basen' }).length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe('/map/');
    const baseId = harness.getSubscriptionValue([appIds.subscriptions.BASES_LIST])[0].id;
    act(() => harness.dispatchSync([appIds.events.BASES_DELETE_BASE, baseId]));
    expect(screen.queryByText('Meine Basen')).not.toBeInTheDocument();
});
