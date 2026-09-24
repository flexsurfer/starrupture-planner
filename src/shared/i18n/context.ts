import { createContext } from 'react';
import { createTranslator } from './core';

export function createLocalization(locale: string, t = createTranslator(locale)) {
    return {
        locale,
        t,
        formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
            new Intl.NumberFormat(locale, { maximumFractionDigits: 1, ...options }).format(value),
    };
}
export const LocalizationContext = createContext(createLocalization('en'));
