import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui';
import type { PlannerResourceSummary } from '../../resources';
import { ResourceRateField } from './ResourceRateField';

export function ResourceItemGroup({ group, focused, color }: { group: PlannerResourceSummary; focused: boolean; color: string }) {
    const { t, formatNumber } = useTranslation();
    const runtime = useRuntime();
    const used = formatNumber(group.usedRate, { maximumFractionDigits: 2 });
    const available = formatNumber(group.availableRate, { maximumFractionDigits: 2 });
    const usagePercent = group.availableRate > 0 ? Math.min(100, Math.max(0, group.usedRate / group.availableRate * 100)) : 0;
    const usageLabel = t('{percent}% used', { percent: formatNumber(usagePercent, { maximumFractionDigits: 1 }) });
    const usageDescription = t('Used {used} of {available}/min', { used, available });
    return <details data-resource-item={group.itemId} open={focused}
        className={`group/resource ${focused ? 'rounded-md bg-primary/5 ring-1 ring-primary/20 px-2' : ''}`}>
        <summary className="min-w-0 cursor-pointer list-none rounded py-2.5 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0"><ItemImage itemId={group.itemId} item={{ name: group.name }} size="small" /></span>
                <h3 className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-base-content/85">{group.name}</h3>
                <span className="shrink-0 text-right text-base font-semibold tabular-nums" style={{ color }} title={t('Available resources')}>
                    {available}<span className="ml-0.5 text-[11px] font-normal">{t('/min')}</span>
                </span>
                <span aria-hidden="true" className="text-xs text-base-content/40 transition-transform group-open/resource:rotate-90">›</span>
            </div>
            <div role="meter" aria-label={t('Resource capacity used')} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={usagePercent} aria-valuetext={`${usageLabel}: ${usageDescription}`} title={usageDescription} className="mt-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] leading-tight tabular-nums text-base-content/60">
                    <span>{usageDescription}</span>
                    <span>{usageLabel}</span>
                </div>
                <div className="h-1 w-full overflow-hidden bg-base-content/10">
                    <div className="h-full" style={{ width: `${usagePercent}%`, backgroundColor: color }} />
                </div>
            </div>
        </summary>
        <div className="mb-2 space-y-2 p-2">
            {group.isTarget && <p className="text-xs text-warning">{t('Target resource is not used by this plan.')}</p>}
            {group.rows.map(row => <div key={row.id} className="flex min-w-0 items-center gap-2 text-xs">
                <input type="checkbox" className="checkbox checkbox-xs shrink-0" checked={row.enabled}
                    aria-label={t('Enable resource {name}', { name: group.name })}
                    onChange={event => runtime.dispatch([appIds.events.PLANNER_SET_RESOURCE_ENABLED, row.id, event.target.checked])} />
                <div className={`min-w-0 flex-1 ${row.enabled ? '' : 'opacity-45'}`}>
                    <p className="truncate text-xs font-medium" title={row.coreName}>{row.coreName ?? t('Manual')}</p>
                </div>
                <ResourceRateField value={row.ratePerMinute} label={t('Resource amount for {name}', { name: group.name })}
                    onChange={amount => runtime.dispatch([appIds.events.PLANNER_SET_RESOURCE_RATE, row.id, amount])} />
                <span className="text-xs text-base-content/45">{t('/min')}</span>
                <button type="button" className="btn btn-ghost btn-sm btn-square shrink-0 text-base-content/50 hover:text-error" aria-label={t('Remove resource {name}', { name: group.name })}
                    onClick={() => runtime.dispatch([appIds.events.PLANNER_REMOVE_RESOURCE, row.id])}>×</button>
            </div>)}
        </div>
    </details>;
}
