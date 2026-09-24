import { describe, expect, it } from 'vitest';
import { createTranslator, message, translateText, type MessageCatalog, type PluralMessage } from './core';
import { normalizeLocale } from './locales';
import english from './locales/en.json';

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
const protectedTerms = ['Core', 'StarRupture', 'Rupture Planner', 'Discord', 'GitHub', 'MW', 'G', 'Copy', 'Ctrl+V', 'V.2'];
const forms = (entry: string | PluralMessage) => typeof entry === 'string' ? [entry] : Object.values(entry);

describe('UI localization', () => {
    it('falls back to English per message, including English plural rules', () => {
        const t = createTranslator('ru', { Cancel: 'Отмена' });
        expect(t('Cancel')).toBe('Отмена');
        expect(t('{count} buildings', { count: 1 })).toBe('1 building');
        // Russian treats 21 as "one"; an untranslated English message must use English rules.
        expect(t('{count} buildings', { count: 21 })).toBe('21 buildings');
    });

    it('supports language-specific plural forms and locale number formatting', () => {
        const t = createTranslator('ru', {
            '{count} buildings': { one: '{count} здание', few: '{count} здания', many: '{count} зданий', other: '{count} здания' },
        });
        expect([1, 2, 5, 21].map(count => t('{count} buildings', { count })))
            .toEqual(['1 здание', '2 здания', '5 зданий', '21 здание']);
        expect(createTranslator('de')('{rate}/min missing', { rate: 1234.5678 })).toBe('1.234,5678/min missing');
    });

    it('interpolates literal game/user names without translating or recursively parsing them', () => {
        const t = createTranslator('de', { 'Remove {name}?': '{name} entfernen?' });
        const name = 'Wolfram Ore {count} <b>Core</b>';
        expect(t('Remove {name}?', { name })).toBe(`${name} entfernen?`);
        const stored = message('Remove {name}?', { name });
        expect(translateText(createTranslator('en'), stored)).toBe(`Remove ${name}?`);
        expect(translateText(t, stored)).toBe(`${name} entfernen?`);
        expect(translateText(t, 'My factory')).toBe('My factory');
    });

    it('handles unavailable, malformed, and regional saved language settings', () => {
        expect(['en-US', 'EN_gb', ' en '].map(normalizeLocale)).toEqual(['en', 'en', 'en']);
        expect([null, 1, {}, 'unknown', '__proto__', 'constructor'].map(normalizeLocale)).toEqual(Array(6).fill('en'));
    });

    it('keeps every English plural form compatible with its message placeholders', () => {
        for (const [key, entry] of Object.entries(english)) {
            for (const form of forms(entry)) expect(placeholders(form), key).toEqual(placeholders(key));
        }
    });

    const catalogs = import.meta.glob<{ default: MessageCatalog }>('./locales/*.json', { eager: true });
    for (const [file, { default: catalog }] of Object.entries(catalogs)) {
        it(`validates keys, plural fallback, and interpolation variables in ${file}`, () => {
            for (const [key, entry] of Object.entries(catalog)) {
                expect(Object.hasOwn(english, key), `${file}: unknown key ${key}`).toBe(true);
                expect(entry).toBeDefined();
                if (typeof entry !== 'string') expect(entry).toHaveProperty('other');
                for (const form of forms(entry!)) {
                    expect(form.trim(), `${file}: empty ${key}`).not.toBe('');
                    expect(placeholders(form), `${file}: ${key}`).toEqual(placeholders(key));
                    for (const term of protectedTerms) {
                        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
                        if (pattern.test(key)) expect(form, `${file}: preserve ${term} in ${key}`).toMatch(pattern);
                    }
                }
            }
        });
    }
});
