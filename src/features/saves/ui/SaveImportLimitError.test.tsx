import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/shared/i18n/I18nProvider';
import german from '@/shared/i18n/locales/de.json';
import french from '@/shared/i18n/locales/fr.json';
import polish from '@/shared/i18n/locales/pl.json';
import { SaveImportLimitError } from './SaveImportLimitError';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const diagnostic = { subcode: 'power-network-records', actual: 100_001, limit: 100_000 } as const;

it.each([
    { locale: 'de', messages: german }, { locale: 'fr', messages: french }, { locale: 'pl', messages: polish },
])('localizes $locale instructions while copying exact diagnostic codes and counters', async ({ locale, messages }) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<I18nProvider locale={locale} messages={messages}><SaveImportLimitError diagnostic={diagnostic} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent(messages['Save import stopped at an internal limit.']);
    expect(screen.getByText(messages['Copy this message and send it in Discord so the developer can investigate and fix the issue.'])).toBeVisible();
    expect(screen.getByTitle(messages['Join Discord'])).toHaveAttribute('href', 'https://discord.gg/P62bkGbC6F');
    fireEvent.click(screen.getByRole('button', { name: messages['Copy error message'] }));
    expect(await screen.findByRole('status')).toHaveTextContent(messages.Copied);
    expect(writeText).toHaveBeenCalledWith(`Rupture Planner\n${messages['Save import stopped at an internal limit.']}\n\nerror: complexity\nsubcode: power-network-records\nactual: 100001\nlimit: 100000`);
});

it.each(['unavailable', 'denied'] as const)('keeps the report selectable and explains manual copying when the clipboard is %s', async condition => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    vi.stubGlobal('navigator', condition === 'unavailable' ? {} : { clipboard: { writeText } });
    render(<SaveImportLimitError diagnostic={diagnostic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not copy the message. Select and copy the text manually.');
    expect(screen.getByRole('alert')).toHaveClass('select-text');
    expect(screen.getByRole('alert')).toHaveTextContent('subcode: power-network-records');
    expect(screen.getByRole('button', { name: 'Copy error message' })).toBeEnabled();
});

it('can copy an older generic complexity error without inventing a subcode or counters', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<SaveImportLimitError diagnostic={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
    expect(writeText).toHaveBeenCalledWith('Rupture Planner\nSave import stopped at an internal limit.\n\nerror: complexity');
});
