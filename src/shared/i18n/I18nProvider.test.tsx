import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from './I18nProvider';
import { useTranslation } from './index';
import type { MessageCatalog } from './core';
import * as locales from './locales';

function deferredCatalog() {
    let resolve!: (messages: MessageCatalog) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<MessageCatalog>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function Content() {
    const { t } = useTranslation();
    return <><span>{t('Cancel')}</span><input aria-label="Draft" defaultValue="" /></>;
}

beforeEach(() => vi.spyOn(locales, 'getLocaleMessages').mockReturnValue(undefined));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('renders English while loading and updates translations without remounting children', async () => {
    const german = deferredCatalog();
    vi.spyOn(locales, 'loadLocaleMessages').mockReturnValue(german.promise);
    render(<StrictMode><I18nProvider locale="de"><Content /></I18nProvider></StrictMode>);
    expect(screen.getByText('Cancel')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'My factory' } });

    await act(async () => { german.resolve({ Cancel: 'Abbrechen' }); });
    expect(screen.getByText('Abbrechen')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('My factory');
});

it('ignores an older download when languages are switched before it completes', async () => {
    const german = deferredCatalog();
    const french = deferredCatalog();
    vi.spyOn(locales, 'loadLocaleMessages').mockImplementation(locale => locale === 'de' ? german.promise : french.promise);
    const view = render(<I18nProvider locale="de"><Content /></I18nProvider>);
    view.rerender(<I18nProvider locale="fr"><Content /></I18nProvider>);

    await act(async () => { french.resolve({ Cancel: 'Annuler' }); });
    expect(screen.getByText('Annuler')).toBeVisible();
    await act(async () => { german.resolve({ Cancel: 'Abbrechen' }); });
    expect(screen.getByText('Annuler')).toBeVisible();
    expect(screen.queryByText('Abbrechen')).not.toBeInTheDocument();
});

it('keeps the interface usable when a locale chunk fails to load', async () => {
    const german = deferredCatalog();
    vi.spyOn(locales, 'loadLocaleMessages').mockReturnValue(german.promise);
    render(<I18nProvider locale="de"><Content /></I18nProvider>);
    await act(async () => { german.reject(new Error('offline')); });
    expect(screen.getByText('Cancel')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBeVisible();
});

it('uses cached or explicitly supplied catalogs without downloading', () => {
    const load = vi.spyOn(locales, 'loadLocaleMessages');
    vi.mocked(locales.getLocaleMessages).mockReturnValue({ Cancel: 'Abbrechen' });
    const view = render(<I18nProvider locale="de"><Content /></I18nProvider>);
    expect(screen.getByText('Abbrechen')).toBeVisible();
    view.rerender(<I18nProvider locale="ru" messages={{ Cancel: 'Отмена' }}><Content /></I18nProvider>);
    expect(screen.getByText('Отмена')).toBeVisible();
    expect(load).not.toHaveBeenCalled();
});
