import { useState } from 'react';
import DiscordButton from '@/features/app-shell/ui/DiscordButton';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { saveImportDiagnosticData, type SaveImportDiagnostic } from '../import-error';
import { MAX_SAVE_BYTES, MAX_DECODED_SAVE_BYTES } from '../import-limits';
import type { SaveImportState } from '../types';

const messages: Record<NonNullable<SaveImportState['error']>, MessageKey> = {
    'core-identity': 'A Core identity could not be read.',
    position: 'A building could not be assigned to its nearest Core.',
    transport: 'Cargo connections must pair one dispatcher with one receiver.',
    selection: 'Choose a .sav game save.',
    extension: 'Choose a .sav file from your game version folder. {saveDataFile} and .met files cannot be imported. Do not rename them to .sav.',
    'file-size': 'Choose a .sav file no larger than {fileLimit} MiB.',
    format: 'This file is not a supported StarRupture save. Choose an original .sav file from your game version folder, or create a new save in the game and try again.',
    'size-header': "The save's size information is invalid or does not match its contents. Create a new save in the game and try importing it.",
    'size-mismatch': "The save's size information is invalid or does not match its contents. Create a new save in the game and try importing it.",
    'declared-size': 'This file reports an unpacked size above the {decodedLimit} MiB import limit. Its size information may be incorrect. Try a fresh save from the game.',
    'decoded-size': 'This save expands beyond the {decodedLimit} MiB import limit when unpacked.',
    complexity: 'Save import stopped at an internal limit.',
    compression: 'This save could not be unpacked. It may be incomplete or damaged. Copy the original .sav file again, or create a new save in the game.',
    structure: 'This file is not a supported StarRupture save. Choose an original .sav file from your game version folder, or create a new save in the game and try again.',
    'unsupported-browser': 'This browser does not support save import.',
    read: 'Could not read this save. Try choosing the file again.', timeout: 'Reading the save timed out. Try again.',
    catalog: 'Could not load game data. Check your connection and reload the page.',
    mappings: 'Could not load game data. Check your connection and reload the page.',
    'mapping-version': 'This save cannot be imported with the supported game data.',
    'workspace-limit': 'There is no room for another save. Remove a save and try again.',
    'save-storage-limit': 'This save is too large to store in this browser.',
};

export function SaveImportErrorPanel({ error, diagnostic }: {
    error: NonNullable<SaveImportState['error']>; diagnostic: SaveImportDiagnostic | null;
}) {
    const { t } = useTranslation();
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
    const description = t(messages[error], {
        fileLimit: MAX_SAVE_BYTES / (1024 * 1024), decodedLimit: MAX_DECODED_SAVE_BYTES / (1024 * 1024),
        saveDataFile: 'SaveData.dat',
    });
    // Keep diagnostic IDs and exact counters identical in every locale and in copied reports.
    const details = [`error: ${error}`, ...Object.entries(saveImportDiagnosticData(error, diagnostic))
        .map(([key, value]) => `${key}: ${value}`)].join('\n');
    const copy = async () => {
        setCopyStatus('copying');
        try {
            await navigator.clipboard.writeText(`Rupture Planner\n${description}\n\n${details}`);
            setCopyStatus('copied');
        } catch { setCopyStatus('failed'); }
    };
    return <div className="mt-4 space-y-3 rounded-lg border border-error/30 bg-error/5 p-4 text-sm">
        <div role="alert" className="space-y-2 select-text">
            <p className="font-medium text-error">{description}</p>
            <details open={copyStatus === 'failed' || undefined}>
                <summary className="cursor-pointer text-xs text-base-content/70">{t('Technical details')}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-base-200 p-3 text-xs">{details}</pre>
            </details>
        </div>
        <p className="text-base-content/70">{t('If the problem continues, copy this message and share it in Discord.')}</p>
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={copyStatus === 'copying'} onClick={() => void copy()}>
                {t('Copy error message')}
            </button>
            <DiscordButton />
        </div>
        {copyStatus === 'copied' && <p role="status" className="text-success">{t('Copied')}</p>}
        {copyStatus === 'failed' && <p role="status" className="text-error">{t('Could not copy the message. Select and copy the text manually.')}</p>}
    </div>;
}
