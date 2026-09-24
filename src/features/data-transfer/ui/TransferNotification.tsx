import { useTranslation, translateText } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

/** Local export actions report download failures as well as successful saves. */
export function TransferNotification() {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const status = useSubscription([appIds.subscriptions.DATA_TRANSFER_STATUS]);
    if (!status) return null;
    return <div className="toast toast-end z-50 max-w-full">
        <div role={status.kind === 'error' ? 'alert' : 'status'} className={`alert shadow-lg ${status.kind === 'error' ? 'alert-error' : 'alert-success'}`}>
            <span>{translateText(t, status.message)}</span>
            <button type="button" className="btn btn-ghost btn-xs btn-square" aria-label={t("Dismiss notification")}
                onClick={() => runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, null])}>✕</button>
        </div>
    </div>;
}
