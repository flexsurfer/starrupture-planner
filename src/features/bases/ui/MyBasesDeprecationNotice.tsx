import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';

const dismissalKey = 'starrupture-planner/my-bases-deprecation-dismissed';

function isDismissed() {
    try {
        return sessionStorage.getItem(dismissalKey) === 'true';
    } catch {
        return false;
    }
}

export function MyBasesDeprecationNotice() {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(isDismissed);
    const dismiss = () => {
        setDismissed(true);
        try {
            sessionStorage.setItem(dismissalKey, 'true');
        } catch {
            // The close control still works when browser storage is unavailable.
        }
    };
    if (dismissed) return null;

    return <aside role="note" className="m-2 flex shrink-0 items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm lg:mx-3">
        <p className="min-w-0 flex-1 self-center text-base-content/85">
            {t('My Bases is deprecated and will not be supported in future versions. Use Factory Map instead.')}
        </p>
        <button type="button" className="btn btn-sm btn-ghost btn-square shrink-0"
            aria-label={t('Hide this notice for this session')} title={t('Hide this notice for this session')} onClick={dismiss}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m6 6 12 12M6 18 18 6" />
            </svg>
        </button>
    </aside>;
}
