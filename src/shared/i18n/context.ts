import { createContext } from 'react';
import { createTranslator } from './core';

export function createLocalization(locale: string, t = createTranslator(locale)) {
    const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return {
        locale,
        t,
        formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
            (options ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1, ...options }) : numberFormatter).format(value),
    };
}
export const LocalizationContext = createContext(createLocalization('en'));
