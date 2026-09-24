import { useEffect, type ReactNode } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { I18nProvider } from '@/shared/i18n/I18nProvider';
import { locales, normalizeLocale } from '@/shared/i18n/locales';

export function AppLocalization({ children }: { children: ReactNode }) {
    const locale = normalizeLocale(useSubscription([appIds.subscriptions.UI_LOCALE]));
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = locales[locale].direction;
    }, [locale]);
    return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
