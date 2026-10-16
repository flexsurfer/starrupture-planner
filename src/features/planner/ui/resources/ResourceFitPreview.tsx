import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui';
import { getItemCategoryColor } from '@/utils/itemColors';

export function ResourceFitPreview() {
    const { t, formatNumber } = useTranslation();
    const runtime = useRuntime();
    const fit = useSubscription([appIds.subscriptions.PLANNER_RESOURCE_FIT]);
    const current = useSubscription([appIds.subscriptions.PLANNER_TARGET_AMOUNT]);
    const itemId = useSubscription([appIds.subscriptions.PLANNER_SELECTED_ITEM_ID]);
    const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    if (!itemId || !fit.available || fit.targetAmount === null || Math.abs(fit.targetAmount - current) < 0.005) return null;
    const item = itemsById[itemId];
    const name = item?.name ?? itemId;
    return <section className="shrink-0 border-t border-base-300 px-4 py-3" aria-label={t('Fit target')}>
        <div className="rounded-lg border border-base-content/10 bg-base-200/40 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0"><ItemImage itemId={itemId} item={{ name }} size="small" /></span>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-base-content/50">{t('Target')}</p>
                    <h3 className="break-words text-sm font-medium leading-snug text-base-content/85">{name}</h3>
                </div>
                <div className="flex max-w-[50%] shrink-0 flex-wrap items-baseline justify-end gap-x-1 text-right tabular-nums">
                    <span className="text-xs text-base-content/50">{formatNumber(current, { maximumFractionDigits: 2 })}{' →'}</span>
                    <span className="text-base" style={{ color: getItemCategoryColor(item?.type) }}>
                        <strong className="font-semibold">{formatNumber(fit.targetAmount, { maximumFractionDigits: 2 })}</strong>
                        <span className="ml-0.5 text-[11px]">{t('/min')}</span>
                    </span>
                </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm mt-3 w-full" title={t('Other required resources are produced by the plan.')}
                onClick={() => runtime.dispatch([appIds.events.PLANNER_APPLY_RESOURCE_FIT])}>{t('Fit target')}</button>
        </div>
    </section>;
}
