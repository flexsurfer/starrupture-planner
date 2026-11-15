import { useState } from 'react';
import DiscordButton from '@/features/app-shell/ui/DiscordButton';
import { useTranslation } from '@/shared/i18n';
import type { SaveImportDiagnostic } from '../import-error';

export function SaveImportLimitError({ diagnostic }: { diagnostic: SaveImportDiagnostic | null }) {
    const { t } = useTranslation();
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
    const description = t('Save import stopped at an internal limit.');
    // Keep diagnostic IDs and exact counters identical in every locale and in copied reports.
    const details = ['error: complexity', ...(diagnostic ? [
        `subcode: ${diagnostic.subcode}`, `actual: ${diagnostic.actual}`, `limit: ${diagnostic.limit}`,
    ] : [])].join('\n');
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
            <pre className="whitespace-pre-wrap break-all rounded bg-base-200 p-3 text-xs">{details}</pre>
        </div>
        <p className="text-base-content/70">{t('Copy this message and send it in Discord so the developer can investigate and fix the issue.')}</p>
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
