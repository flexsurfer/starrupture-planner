import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, type MessageCatalog } from './core';
import { LocalizationContext, createLocalization } from './context';
import { getLocaleMessages, loadLocaleMessages, normalizeLocale } from './locales';

/** Context projects Uklad's language setting; it does not own application state. */
export function I18nProvider({ locale, messages, children }: { locale: string; messages?: MessageCatalog; children: ReactNode }) {
    const resolved = normalizeLocale(locale);
    const cached = getLocaleMessages(resolved);
    const [loaded, setLoaded] = useState<{ locale: string; messages: MessageCatalog }>();
    useEffect(() => {
        if (messages !== undefined || cached !== undefined) return;
        let active = true;
        void loadLocaleMessages(resolved).then(catalog => {
            if (active) setLoaded({ locale: resolved, messages: catalog });
        }, () => {
            // English stays usable when a catalog cannot be downloaded.
        });
        return () => { active = false; };
    }, [resolved, messages, cached]);

    // Explicit catalogs are useful for previews and integration tests before registering a locale.
    const language = messages ? locale : resolved;
    const catalog = messages ?? (loaded?.locale === resolved ? loaded.messages : cached);
    const value = useMemo(() => createLocalization(language, createTranslator(language, catalog)), [language, catalog]);
    return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}
