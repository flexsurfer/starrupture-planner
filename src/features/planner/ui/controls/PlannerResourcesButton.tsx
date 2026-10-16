import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';

export function PlannerResourcesButton({ open, panelId, onClick }: { open: boolean; panelId: string; onClick: () => void }) {
    const { t, formatNumber } = useTranslation();
    const resources = useSubscription([appIds.subscriptions.PLANNER_RESOURCE_SUMMARY]);
    return <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onClick}
        className={`btn btn-sm gap-2 border ${open ? 'border-primary bg-primary/10 text-primary' : 'btn-ghost border-base-300'}`}>
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v8l9 5 9-5V8M12 13v8" />
        </svg>
        <span>{t('Resources')}</span>
        {resources.length > 0 && <span className="text-xs tabular-nums">{formatNumber(resources.length)}</span>}
    </button>;
}
