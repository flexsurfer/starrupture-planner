import { useTranslation, type MessageKey } from '@/shared/i18n';
import { BuildingImage, ItemImage } from '@/shared/ui';
import { getItemCategoryColor } from '@/utils/itemColors';
import type { SaveResource, SaveResourceBuilding } from '../overview';

const resourceSources: Record<SaveResource['source'], MessageKey> = {
    extraction: 'Local extraction', delivery: 'Imported from other Cores', shipment: 'Sent to other Cores',
    corporation: 'Sent to corporations', production: 'Configured production',
};

export function ResourceRows({ resources, empty, expandable = true }: {
    resources: SaveResource[]; empty?: MessageKey; expandable?: boolean;
}) {
    const { t, formatNumber } = useTranslation();
    const rate = (value: number | null) => value === null ? <span className="text-base-content/35">—</span>
        : <>{formatNumber(value, { maximumFractionDigits: 1 })}<span className="ml-0.5 text-[11px] font-normal">{t('/min')}</span></>;
    const route = (source: SaveResource['source'], building: SaveResourceBuilding) => {
        const core = building.relatedCore;
        if (!core && !building.relatedBuilding) return t('No linked output');
        const name = core ? core.name ?? t('Core {number}', { number: core.number }) : t('Unassigned Core');
        if (building.relatedBuilding) {
            if (source === 'delivery') return t('From {coreName} · {dispatcherName}', {
                coreName: name, dispatcherName: building.relatedBuilding.name,
            });
            if (source === 'shipment') return t('To {coreName} · {receiverName}', {
                coreName: name, receiverName: building.relatedBuilding.name,
            });
        }
        return t(source === 'delivery' ? 'From {name}' : 'To {name}', { name });
    };
    if (!resources.length) return empty ? <p className="py-3 text-xs text-base-content/40">{t(empty)}</p> : null;
    return <div className="divide-y divide-base-content/5">{resources.map(resource => {
        const hasRoute = resource.source === 'delivery' || resource.source === 'shipment';
        const routes = [...new Set(resource.buildings.map(building => route(resource.source, building)))];
        const content = <>
            <span className="shrink-0"><ItemImage itemId={resource.itemId} item={{ name: resource.name }} size="small" /></span>
            <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium leading-snug text-base-content/85">{resource.name}</span>
                <span className="mt-0.5 block text-[11px] text-base-content/45">{hasRoute ? routes.join(' · ') : t(resourceSources[resource.source])}</span>
            </span>
            <span className="shrink-0 text-right text-base font-semibold tabular-nums" style={{ color: getItemCategoryColor(resource.type) }}
                title={t(resource.rate === null ? 'Rate unavailable' : 'Configured capacity')}>{rate(resource.rate)}</span>
        </>;
        return expandable ? <details key={`${resource.source}:${resource.itemId}`} className="group/resource">
            <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2.5 rounded py-2.5 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                {content}<span aria-hidden="true" className="text-xs text-base-content/40 transition-transform group-open/resource:rotate-90">›</span>
            </summary>
            <ul className="mb-2 space-y-2 p-2 text-base-content/50" aria-label={t('Buildings')}>
                {resource.buildings.map((building, index) => <li key={`${building.buildingId}:${index}`} className="flex min-w-0 items-center gap-2 text-xs">
                    <BuildingImage buildingId={building.buildingTypeId} building={{ name: building.name }} size="xsmall" />
                    <span className="min-w-0 flex-1 break-words">
                        {building.name}
                        {hasRoute && <span className="block text-[11px] text-base-content/40">{route(resource.source, building)}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{rate(building.rate)}</span>
                </li>)}
            </ul>
        </details> : <div key={`${resource.source}:${resource.itemId}`} className="flex min-w-0 items-center gap-2.5 py-2.5">{content}</div>;
    })}</div>;
}
