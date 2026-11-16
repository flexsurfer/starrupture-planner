import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';

export function AppUpdateNotice() {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const version = useSubscription([appIds.subscriptions.APP_AVAILABLE_VERSION]);
    if (!version) return null;

    return <div role="status" className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-info/30 bg-info/10 px-3 py-1.5 text-xs">
        <span>{t('App update available: {version}', { version })}</span>
        <button type="button" className="btn btn-info btn-xs"
            onClick={() => runtime.dispatch([appIds.events.APP_RELOAD_FOR_UPDATE])}>
            {t('Reload to update')}
        </button>
    </div>;
}
