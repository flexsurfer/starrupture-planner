import { useId } from 'react';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { BuildingImage, ItemImage } from '@/shared/ui';
import { getItemCategoryColor } from '@/utils/itemColors';
import { useModalDialog } from '@/shared/ui/useModalDialog';
import type { SaveCoreOverview, SaveBuildingSection } from '../overview';

const sections: { id: SaveBuildingSection; title: MessageKey }[] = [
    { id: 'incoming', title: 'Incoming resources' }, { id: 'outgoing', title: 'Outgoing resources' },
    { id: 'production', title: 'Production' }, { id: 'energy', title: 'Energy' }, { id: 'infrastructure', title: 'Infrastructure' },
];

export function SaveCoreDialog({ coreOverview, name, onClose }: {
    coreOverview: SaveCoreOverview; name: string; onClose: () => void;
}) {
    const { t, formatNumber } = useTranslation();
    const dialog = useModalDialog();
    const id = useId();
    return <dialog ref={dialog} className="modal p-3 sm:p-5" aria-labelledby={`${id}-title`}
        onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        }}
        onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="modal-box flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden bg-base-100 p-0">
            <header className="flex shrink-0 items-center gap-3 border-b border-base-300 bg-base-200 p-4">
                <BuildingImage buildingId="base_core" building={{ name: 'Base Core' }} size="small" />
                <div className="min-w-0 flex-1">
                    <h2 id={`${id}-title`} className="break-words font-semibold">{name}</h2>
                    <p className="text-xs text-base-content/60">{t('{count} buildings', { count: coreOverview.buildings.length })}</p>
                </div>
                <button type="button" data-dialog-autofocus className="btn btn-ghost btn-sm btn-square" aria-label={t('Close')} onClick={onClose}>✕</button>
            </header>
            <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-4">
                {sections.map(section => {
                    const individual = section.id === 'incoming' || section.id === 'outgoing';
                    const entries = coreOverview.buildingSections[section.id];
                    if (!entries.length) return null;
                    return <section key={section.id} aria-labelledby={`${id}-${section.id}`}>
                        <h3 id={`${id}-${section.id}`} className="mb-2 text-sm font-semibold">{t(section.title)}</h3>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {entries.map(({ detail, count, resources }) => <article key={individual ? detail.instance.id : detail.building.id}
                                className="min-w-0 rounded-lg border border-base-300 bg-base-200 p-3">
                                <div className="flex items-center gap-2">
                                    <BuildingImage buildingId={detail.building.id} building={detail.building} size="small" />
                                    <div className="min-w-0 flex-1">
                                        <h4 className="break-words text-sm font-medium">{individual && detail.instance.configuration.kind !== 'launcher' ? detail.instance.name ?? detail.building.name : detail.building.name}</h4>
                                        {detail.instance.configuration.kind === 'launcher' && <p className="text-xs text-base-content/60">{t('{count} launchers', { count })}</p>}
                                        {!individual && <p className="text-xs text-base-content/60">{t('{count} buildings', { count })}</p>}
                                    </div>
                                </div>
                                {detail.nodePurity && detail.nodePurity !== 'not-applicable' && <p className="mt-2 text-xs text-base-content/60">{t('Node purity: {purity}', {
                                    purity: t(({ impure: 'Impure', normal: 'Normal', pure: 'Pure' } as const)[detail.nodePurity]),
                                })}</p>}
                                {individual && <div className="mt-2 border-t border-base-content/5 pt-2">
                                    {resources.length ? resources.map(resource => <div key={`${resource.source}:${resource.itemId}`} className="flex items-center gap-2 text-xs">
                                        <ItemImage itemId={resource.itemId} item={{ name: resource.name }} size="xsmall" />
                                        <span className="min-w-0 flex-1 break-words">{resource.name}</span>
                                        <strong className="shrink-0 text-sm tabular-nums" style={{ color: getItemCategoryColor(resource.type) }}
                                            title={t(resource.rate === null ? 'Rate unavailable' : 'Max capacity')}>
                                            {resource.rate === null ? '—' : <>{formatNumber(resource.rate, { maximumFractionDigits: 1 })}<span className="text-xs font-normal">{t('/min')}</span></>}
                                        </strong>
                                    </div>) : <p className="text-xs text-base-content/50">{t('Item unavailable')}</p>}
                                </div>}
                            </article>)}
                        </div>
                    </section>;
                })}
                {coreOverview.buildings.length === 0 && <p className="text-sm text-base-content/50">{t('No buildings in this section.')}</p>}
            </div>
        </div>
    </dialog>;
}
