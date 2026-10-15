import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { BuildingImage } from '@/shared/ui';
import type { SaveCoreOverview } from '../overview';
import type { SaveWorkspace } from '../types';
import { SaveCoreHeat } from './SaveCoreHeat';
import { SaveCoreResources } from './SaveCoreResources';

export function SaveCoreCard({ workspace, coreOverview, name, disabled }: {
    workspace: SaveWorkspace; coreOverview: SaveCoreOverview; name: string; disabled: boolean;
}) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    return <article className="card min-w-0 border border-base-300 bg-base-200" aria-label={name}>
        <div className="card-body flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
                <BuildingImage buildingId="base_core" building={{ name: 'Base Core' }} size="small" className="size-9 shrink-0 object-contain opacity-70" />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium text-base-content/80" title={name}>{name}</h2>
                    <div className="mt-0.5 text-[11px] text-base-content/45">{t('Lv.{level} · {count} buildings', {
                        level: coreOverview.core.level === null ? '—' : coreOverview.core.level + 1, count: coreOverview.buildings.length,
                    })}</div>
                </div>
                <div className="w-32 max-w-[45%] shrink-0">
                    <SaveCoreHeat heat={coreOverview.heat} capacity={coreOverview.heatCapacity} />
                </div>
            </div>
            <SaveCoreResources coreOverview={coreOverview} />
            <div className="mt-auto border-t border-base-content/5 pt-2">
                <button type="button" className="btn btn-ghost btn-sm w-full justify-between text-xs text-base-content/65" disabled={disabled}
                    aria-label={t('Open Core {name}', { name })} onClick={() => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, coreOverview.core.id])}>
                    {t('View details')}<span aria-hidden="true">→</span>
                </button>
            </div>
        </div>
    </article>;
}
