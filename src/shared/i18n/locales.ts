import type { MessageCatalog } from './core';

/** Register only languages with reviewed UI translations. Names are shown in their own language. */
export const locales: Record<string, { name: string; direction: 'ltr' | 'rtl'; loadMessages: () => Promise<MessageCatalog> }> = {
    en: { name: 'English', direction: 'ltr', loadMessages: async () => ({}) },
    de: { name: 'Deutsch', direction: 'ltr', loadMessages: () => import('./locales/de.json').then(module => module.default) },
    fr: { name: 'Français', direction: 'ltr', loadMessages: () => import('./locales/fr.json').then(module => module.default) },
    pl: { name: 'Polski', direction: 'ltr', loadMessages: () => import('./locales/pl.json').then(module => module.default) },
};
export const DEFAULT_LOCALE = 'en';

// These are bundled assets, not application state. Keep requests shared across mounts.
const loadedCatalogs = new Map<string, MessageCatalog>([[DEFAULT_LOCALE, {}]]);
const pendingLoads = new Map<string, Promise<MessageCatalog>>();

/** Synchronous consumers can use English while the selected catalog is loading. */
export const getLocaleMessages = (locale: string): MessageCatalog | undefined =>
    loadedCatalogs.get(normalizeLocale(locale));

export function loadLocaleMessages(locale: string): Promise<MessageCatalog> {
    const resolved = normalizeLocale(locale);
    const cached = loadedCatalogs.get(resolved);
    if (cached) return Promise.resolve(cached);
    const pending = pendingLoads.get(resolved);
    if (pending) return pending;

    const request = locales[resolved].loadMessages().then(messages => {
        loadedCatalogs.set(resolved, messages);
        pendingLoads.delete(resolved);
        return messages;
    }, (error: unknown) => {
        // A failed request can be retried when the language is selected again.
        pendingLoads.delete(resolved);
        throw error;
    });
    pendingLoads.set(resolved, request);
    return request;
}

/** Picks the first supported language from browser preferences, falling back to English. */
export const localeFromPreferences = (values: readonly unknown[]): string => {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const tag = value.trim().toLowerCase().replace(/_/g, '-');
        if (Object.hasOwn(locales, tag)) return tag;
        const language = tag.split('-')[0];
        if (Object.hasOwn(locales, language)) return language;
    }
    return DEFAULT_LOCALE;
};

export const normalizeLocale = (value: unknown): string => {
    if (typeof value !== 'string') return DEFAULT_LOCALE;
    const tag = value.trim().toLowerCase().replace(/_/g, '-');
    if (Object.hasOwn(locales, tag)) return tag;
    const language = tag.split('-')[0];
    return Object.hasOwn(locales, language) ? language : DEFAULT_LOCALE;
};
