import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/shared/i18n/I18nProvider';
import german from '@/shared/i18n/locales/de.json';
import french from '@/shared/i18n/locales/fr.json';
import polish from '@/shared/i18n/locales/pl.json';
import { SaveImportErrorPanel } from './SaveImportErrorPanel';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const diagnostic = { subcode: 'power-network-records', actual: 100_001, limit: 100_000 } as const;

it.each([
    { locale: 'de', messages: german }, { locale: 'fr', messages: french }, { locale: 'pl', messages: polish },
])('localizes $locale instructions while copying exact diagnostic codes and counters', async ({ locale, messages }) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<I18nProvider locale={locale} messages={messages}><SaveImportErrorPanel error="complexity" diagnostic={diagnostic} /></I18nProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent(messages['Save import stopped at an internal limit.']);
    expect(screen.getByText(messages['If the problem continues, copy this message and share it in Discord.'])).toBeVisible();
    expect(screen.getByTitle(messages['Join Discord'])).toHaveAttribute('href', 'https://discord.gg/P62bkGbC6F');
    fireEvent.click(screen.getByRole('button', { name: messages['Copy error message'] }));
    expect(await screen.findByRole('status')).toHaveTextContent(messages.Copied);
    expect(writeText).toHaveBeenCalledWith(`Rupture Planner\n${messages['Save import stopped at an internal limit.']}\n\nerror: complexity\nsubcode: power-network-records\nactual: 100001\nlimit: 100000`);
});

it.each(['unavailable', 'denied'] as const)('keeps the report selectable and explains manual copying when the clipboard is %s', async condition => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    vi.stubGlobal('navigator', condition === 'unavailable' ? {} : { clipboard: { writeText } });
    render(<SaveImportErrorPanel error="complexity" diagnostic={diagnostic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not copy the message. Select and copy the text manually.');
    expect(screen.getByRole('alert')).toHaveClass('select-text');
    expect(screen.getByRole('alert')).toHaveTextContent('subcode: power-network-records');
    expect(screen.getByText(/^error: complexity/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy error message' })).toBeEnabled();
});

it('can copy an older generic complexity error without inventing a subcode or counters', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<SaveImportErrorPanel error="complexity" diagnostic={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy error message' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
    expect(writeText).toHaveBeenCalledWith('Rupture Planner\nSave import stopped at an internal limit.\n\nerror: complexity');
});

it.each([
    { locale: 'de', messages: german }, { locale: 'fr', messages: french }, { locale: 'pl', messages: polish },
])('localizes $locale format recovery while copying locale-independent byte diagnostics', async ({ locale, messages }) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const details = { phase: 'header', decodedBytes: 0, decodedLimitBytes: 1_073_741_824, fileName: 'private.sav' } as const;
    render(<I18nProvider locale={locale} messages={messages}><SaveImportErrorPanel error="format" diagnostic={details} /></I18nProvider>);
    const description = messages['This file is not a supported StarRupture save. Choose an original .sav file from your game version folder, or create a new save in the game and try again.'];
    expect(screen.getByRole('alert')).toHaveTextContent(description);
    expect(screen.getByText(messages['Technical details'])).toBeVisible();
    expect(screen.getByText(/^error: format/)).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: messages['Copy error message'] }));
    expect(await screen.findByRole('status')).toHaveTextContent(messages.Copied);
    expect(writeText).toHaveBeenCalledWith(`Rupture Planner\n${description}\n\nerror: format\ndecode_phase: header\ndecoded_bytes: 0\ndecoded_limit_bytes: 1073741824`);
});
