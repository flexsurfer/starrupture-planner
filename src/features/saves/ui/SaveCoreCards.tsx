import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { BuildingImage } from '@/shared/ui';
import type { SaveCoreOverview } from '../overview';
import type { SaveWorkspace } from '../types';
import { SaveCoreHeat } from './SaveCoreHeat';
import { SaveCoreResources } from './SaveCoreResources';
import { SaveMapIcon } from './SaveMapIcon';
import { SaveCoreSharedBadge } from './SaveCoreSharedBadge';

export function SaveCoreCard({ workspace, coreOverview, name, disabled }: {
    workspace: SaveWorkspace; coreOverview: SaveCoreOverview; name: string; disabled: boolean;
}) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    return <article className="card min-w-0 border border-base-300 bg-base-200" aria-label={name}>
        <div className="card-body flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                    <BuildingImage buildingId="base_core" building={{ name: 'Base Core' }} size="small" className="size-9 shrink-0 object-contain opacity-70" />
                    <SaveCoreSharedBadge coreOverview={coreOverview} />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium text-base-content/80" title={name}>{name}</h2>
                    <div className="mt-0.5 text-[11px] text-base-content/45">{t('Lv.{level} · {count} buildings', {
                        level: coreOverview.core.level === null ? '—' : coreOverview.core.level + 1, count: coreOverview.buildings.length,
                    })}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content" disabled={disabled}
                        title={t('View buildings')} aria-label={t('Open Core {name}', { name })}
                        onClick={() => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, coreOverview.core.id])}>
                        <SaveMapIcon name="details" />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content" disabled={disabled}
                        title={t('Open on map')} aria-label={t('Open Core {name} on map', { name })}
                        onClick={() => runtime.dispatch([appIds.events.SAVES_OPEN_CORE_ON_MAP, workspace.id, coreOverview.core.id])}>
                        <SaveMapIcon name="map" />
                    </button>
                </div>
            </div>
            <SaveCoreHeat heat={coreOverview.heat} capacity={coreOverview.heatCapacity} />
            <SaveCoreResources coreOverview={coreOverview} />
        </div>
    </article>;
}
