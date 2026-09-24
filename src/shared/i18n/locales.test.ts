import { beforeEach, afterEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

it('keeps English ready and loads only the requested catalog, sharing and caching requests', async () => {
    const { locales, getLocaleMessages, loadLocaleMessages } = await import('./locales');
    const german = vi.spyOn(locales.de, 'loadMessages');
    const french = vi.spyOn(locales.fr, 'loadMessages');

    expect(getLocaleMessages('en')).toEqual({});
    expect(getLocaleMessages('de')).toBeUndefined();
    expect(getLocaleMessages('fr')).toBeUndefined();
    await loadLocaleMessages('en');
    await loadLocaleMessages('unknown');
    expect(german).not.toHaveBeenCalled();
    expect(french).not.toHaveBeenCalled();

    const first = loadLocaleMessages('de-DE');
    expect(loadLocaleMessages('de')).toBe(first);
    const catalog = await first;
    expect(catalog.Cancel).toBe('Abbrechen');
    expect(getLocaleMessages('de-DE')).toBe(catalog);
    expect(await loadLocaleMessages('de')).toBe(catalog);
    expect(german).toHaveBeenCalledTimes(1);
    expect(french).not.toHaveBeenCalled();
    expect(getLocaleMessages('fr')).toBeUndefined();
});

it('allows a failed catalog download to be retried', async () => {
    const { locales, getLocaleMessages, loadLocaleMessages } = await import('./locales');
    const french = vi.spyOn(locales.fr, 'loadMessages').mockRejectedValueOnce(new Error('offline'));
    await expect(loadLocaleMessages('fr')).rejects.toThrow('offline');
    expect(getLocaleMessages('fr')).toBeUndefined();

    const catalog = await loadLocaleMessages('fr');
    expect(catalog.Cancel).toBe('Annuler');
    expect(getLocaleMessages('fr')).toBe(catalog);
    expect(french).toHaveBeenCalledTimes(2);
});
