import { useTranslation } from '@/shared/i18n';

/** Coverage is shared; each building and its output still represent one source. */
export function SharedCoverage({ names, count }: { names?: string; count?: number }) {
    const { t } = useTranslation();
    const label = names ? t('Shared across {cores}', { cores: names }) : t('Shared resources');
    return <span className="inline-flex shrink-0 items-center gap-1 text-sky-500" title={label}>
        <svg role="img" aria-label={label} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" />
        </svg>
        {count !== undefined && <span className="text-[11px]">{t('{count} shared', { count })}</span>}
    </span>;
}
