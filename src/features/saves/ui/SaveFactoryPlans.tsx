import { useId, useState } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { PlannerBuildingsTable } from '@/features/planner/ui/stats/PlannerBuildingsTable';
import { translateText, useTranslation } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui/ItemImage';
import type { FactoryPlan } from '../factory-plans';

function FactoryBuildingsTable({ workspaceId, networkId }: { workspaceId: string; networkId: number }) {
    const rows = useSubscription([appIds.subscriptions.SAVES_FACTORY_PLAN_BUILDING_ROWS, workspaceId, networkId]);
    return <PlannerBuildingsTable rows={rows} comparisonScope="network" compact />;
}

function FactoryCard({ workspaceId, plan, onOpen }: { workspaceId: string; plan: FactoryPlan; onOpen: (name: string) => void }) {
    const { t, formatNumber } = useTranslation();
    const items = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const [expanded, setExpanded] = useState(false);
    const comparisonId = useId();
    const label = t('Power network {number}', { number: plan.networkId });
    const formatRate = (amount: number) => formatNumber(amount,
        amount > 0 && amount < 0.01 ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: 2 });
    return <article aria-label={label} className="card min-w-0 bg-base-200">
        <div className="card-body gap-3 p-4">
            <header>
                <h2 className="text-sm font-medium text-base-content/80">{label}</h2>
                {plan.cores.length > 0 && <p className="mt-0.5 wrap-anywhere text-[11px] text-base-content/55">
                    {plan.cores.map(core => core.name || t('Core {number}', { number: core.number })).join(' · ')}
                </p>}
            </header>
            <table className="save-report-table">
                <caption className="sr-only">{t('Final products')}</caption>
                <thead><tr>
                    <th scope="col" className="w-[46%] text-left">{t('Final products')}</th>
                    <th scope="col" className="text-right">{t('Installed capacity')} {t('/min')}</th>
                    <th scope="col" className="text-right">{t('Target rate')} {t('/min')}</th>
                </tr></thead>
                <tbody>{Object.entries(plan.capacity).map(([itemId, capacity]) => <tr key={itemId}>
                    <th scope="row" className="text-left font-medium text-base-content/85">
                        <span className="flex items-center gap-2">
                            <span aria-hidden="true" className="shrink-0"><ItemImage itemId={itemId} size="small" /></span>
                            <span>{items[itemId]?.name ?? itemId}</span>
                        </span>
                    </th>
                    <td className="text-right font-mono text-base-content/70">{formatRate(capacity)}</td>
                    <td className="text-right font-mono text-base-content/70">{plan.targetRates ? formatRate(plan.targetRates[itemId]) : '—'}</td>
                </tr>)}</tbody>
            </table>
            {plan.warning && <p id={`${comparisonId}-warning`} className="flex items-baseline gap-2 text-xs text-(--save-warning-ink)">
                <span aria-hidden="true">⚠</span>{translateText(t, plan.warning)}
            </p>}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                {plan.targetRates && <button type="button" aria-expanded={expanded} aria-controls={comparisonId}
                    className="save-report-disclosure btn btn-ghost btn-xs min-h-7 font-medium text-base-content/65 hover:text-base-content"
                    onClick={() => setExpanded(value => !value)}>{t('Compare buildings')}</button>}
                <button type="button" className="save-report-accent btn btn-ghost btn-xs ml-auto min-h-7 font-normal" disabled={!plan.targetRates}
                    aria-describedby={!plan.targetRates && plan.warning ? `${comparisonId}-warning` : undefined}
                    onClick={() => onOpen(label)}>{t('Open in Planner')}</button>
            </div>
            {plan.targetRates && <div id={comparisonId} hidden={!expanded}>
                {expanded && <FactoryBuildingsTable workspaceId={workspaceId} networkId={plan.networkId} />}
            </div>}
        </div>
    </article>;
}

export function SaveFactoryPlans({ workspaceId }: { workspaceId: string }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const report = useSubscription([appIds.subscriptions.SAVES_FACTORY_PLANS, workspaceId]);
    const loading = useSubscription([appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING]);
    return <div className="save-report space-y-3">
        <div className="flex items-baseline gap-2">
            <span className="badge badge-sm shrink-0 border-warning/30 bg-warning/10 text-(--save-warning-ink)">{t('Experimental')}</span>
            <details className="min-w-0">
                <summary className="save-report-disclosure save-report-accent btn btn-ghost btn-xs h-auto min-h-7 w-fit max-w-full list-none text-start font-medium [&::-webkit-details-marker]:hidden">
                    {t('How rates are calculated')}
                </summary>
                <div className="mt-1 max-w-prose space-y-1 px-2 text-xs leading-relaxed text-base-content/70">
                    <p>{t('Each power network is treated as one factory. Targets are products that no configured recipe on that network uses as an ingredient.')}</p>
                    <p>{t('Installed capacity is the output of the configured buildings at full speed. Target rates keep the same mix and assume enough buildings to use local extraction and incoming cargo (up to 240/min per link).')}</p>
                </div>
            </details>
        </div>
        {!report && <p role="status" className="py-10 text-center text-sm text-base-content/60">
            {t(loading ? 'Loading tools…' : 'Factory plans need matching game data. Select the save’s game version or import the save again.')}
        </p>}
        {report?.plans.length === 0 && <p className="py-10 text-center text-sm text-base-content/60">
            {t('No power networks with final products were found in this save.')}
        </p>}
        {report && report.plans.length > 0 && <div className="save-report-grid">
            {report.plans.map(plan => <FactoryCard key={plan.networkId} workspaceId={workspaceId} plan={plan} onOpen={name => {
                const view = window.matchMedia?.('(max-width: 639px)').matches ? 'table' : 'graph';
                runtime.dispatch([appIds.events.PLANNER_OPEN_FACTORY_PLAN, workspaceId, report.snapshotKey, plan.networkId, crypto.randomUUID(), name, view]);
            }} />)}
        </div>}
    </div>;
}
