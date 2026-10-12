import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { BuildingImage, ExpandableSection } from '@/shared/ui';
import type { SaveCoreOverview, SaveBuildingView, SaveBuildingSection } from '../overview';
import type { SaveWorkspace } from '../types';
import { SaveCoreEnergy } from './SaveCoreEnergy';
import { SaveCoreHeat } from './SaveCoreHeat';
import { SaveCoreObjective } from './SaveCoreObjective';
import { ResourceRows } from './SaveResourceRows';

export function SaveCoreCard({ workspace, coreOverview, name, disabled, detail = false }: {
    workspace: SaveWorkspace; coreOverview: SaveCoreOverview; name: string; disabled: boolean; detail?: boolean;
}) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const buildingTypes = [...new Map(coreOverview.buildingDetails.map(detail => [detail.building.id, detail.building])).values()];
    return <article className="card h-full min-w-0 border border-base-300 bg-base-200" aria-label={name}>
        <div className="card-body flex min-w-0 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <BuildingImage buildingId="base_core" building={{ name: 'Base Core' }} size="small" className="size-9 shrink-0 object-contain opacity-70" />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium text-base-content/80" title={name}>{name}</h2>
                    <div className="mt-0.5 text-[11px] text-base-content/45">{t('Lv.{level} · {count} buildings', {
                        level: coreOverview.core.level === null ? '—' : coreOverview.core.level + 1, count: coreOverview.buildings.length,
                    })}</div>
                </div>
            </div>
            <div className="space-y-2">
                <SaveCoreHeat heat={coreOverview.heat} capacity={coreOverview.heatCapacity} />
                <SaveCoreEnergy networks={coreOverview.powerNetworks} cores={workspace.snapshot.cores} />
            </div>
            <SaveCoreObjective workspace={workspace} coreId={coreOverview.core.id} disabled={disabled} shipments={coreOverview.corporationShipments} />
            <div className={detail ? 'grid gap-x-8 md:grid-cols-2' : ''}>
                <section className="min-w-0 border-t border-base-content/5 pt-3" aria-label={t('Available resources')}>
                    <h3 className="text-xs font-medium text-base-content/55"><span aria-hidden="true" className="mr-1.5 text-sky-400">↘</span>{t('Available resources')}</h3>
                    <h4 className="mt-3 text-[11px] font-medium text-base-content/45">{t('Local extraction')}</h4>
                    <ResourceRows resources={coreOverview.incoming.filter(resource => resource.source === 'extraction')} empty="No locally extracted resources" />
                    <h4 className="mt-3 text-[11px] font-medium text-base-content/45">{t('Imported from other Cores')}</h4>
                    <ResourceRows resources={coreOverview.incoming.filter(resource => resource.source === 'delivery')} empty="No imported resources" />
                </section>
                <section className="min-w-0 border-t border-base-content/5 pt-3" aria-label={t('Sent to other Cores')}>
                    <h3 className="text-xs font-medium text-base-content/55"><span aria-hidden="true" className="mr-1.5 text-emerald-400">↗</span>{t('Sent to other Cores')}</h3>
                    <ResourceRows resources={coreOverview.outgoing} empty="No shipments to other Cores" />
                </section>
            </div>
            <div className="mt-auto space-y-3 border-t border-base-content/5 pt-3">
                <div className="flex flex-wrap gap-3">{buildingTypes.map(building => <span key={building.id} title={building.name} className="inline-flex items-center gap-1 text-[11px] text-base-content/50">
                    <BuildingImage buildingId={building.id} building={building} size="xsmall" />
                    {coreOverview.buildings.filter(instance => instance.buildingTypeId === building.id).length}
                </span>)}</div>
                {!detail && <button type="button" className="btn btn-ghost btn-sm w-full justify-between text-xs text-base-content/65" disabled={disabled}
                    aria-label={t('Open Core {name}', { name })} onClick={() => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, coreOverview.core.id])}>
                    {t('Buildings')}<span aria-hidden="true">→</span>
                </button>}
            </div>
        </div>
    </article>;
}

function BuildingCard({ detail }: { detail: SaveBuildingView }) {
    const { t, formatNumber } = useTranslation();
    const name = detail.instance.name ?? detail.building.name;
    return <article className="min-w-0 rounded-lg border border-base-300 bg-base-200 p-2 sm:p-3">
        <div className="flex items-start gap-2">
            <BuildingImage buildingId={detail.building.id} building={detail.building} size="small" className="shrink-0" />
            <div className="min-w-0 flex-1">
                <h3 className="break-words text-sm font-medium leading-snug text-base-content/80">{name}</h3>
                {name !== detail.building.name && <p className="mt-0.5 text-[11px] text-base-content/45">{detail.building.name}</p>}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-base-content/50 tabular-nums">
                    {detail.building.power !== undefined && <span title={t(detail.section === 'energy' ? 'Power generation' : 'Power consumption')}>⚡ {detail.section === 'energy' ? '+' : ''}{formatNumber(detail.building.power)} MW</span>}
                    {detail.building.heat !== undefined && <span title={t('Heat')}>🔥 {formatNumber(detail.building.heat)}</span>}
                </div>
            </div>
        </div>
        {detail.nodePurity && detail.nodePurity !== 'not-applicable' && <p className="mt-2 text-[11px] text-base-content/50">{t('Node purity: {purity}', {
            purity: t(({ impure: 'Impure', normal: 'Normal', pure: 'Pure' } as const)[detail.nodePurity]),
        })}</p>}
        {detail.resources.length > 0 && <div className="mt-2 rounded-md bg-base-content/5 px-2"><ResourceRows resources={detail.resources} expandable={false} /></div>}
        {detail.section === 'production' && detail.resources.length === 0 && detail.instance.configuration.kind === 'production' && detail.instance.configuration.recipeId === null && <p className="mt-3 text-xs text-base-content/40">{t('Recipe unavailable')}</p>}
    </article>;
}

const sections: { id: SaveBuildingSection; title: MessageKey }[] = [
    { id: 'incoming', title: 'Incoming resources' }, { id: 'production', title: 'Production' },
    { id: 'outgoing', title: 'Outgoing resources' }, { id: 'energy', title: 'Energy' }, { id: 'infrastructure', title: 'Infrastructure' },
];
export function SaveBuildingSections({ coreOverview }: { coreOverview: SaveCoreOverview }) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState<SaveBuildingSection[]>([]);
    return <div className="space-y-3">{sections.map(section => {
        const details = coreOverview.buildingDetails.filter(detail => detail.section === section.id);
        return <ExpandableSection key={section.id} title={t(section.title)} icon={null}
            summary={t('{count} buildings', { count: details.length })}
            expanded={!collapsed.includes(section.id)} onToggle={() => setCollapsed(value => value.includes(section.id) ? value.filter(id => id !== section.id) : [...value, section.id])}>
            {details.length ? <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-2">
                {details.map(detail => <BuildingCard key={detail.instance.id} detail={detail} />)}
            </div> : <p className="text-xs text-base-content/40">{t('No buildings in this section.')}</p>}
        </ExpandableSection>;
    })}</div>;
}
