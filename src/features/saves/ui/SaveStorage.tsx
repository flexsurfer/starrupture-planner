import { useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { useTranslation, type Translator } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui';
import type { SaveStorageGroup } from '../storage-inventory';
import { useCardTablePreview } from './useCardTablePreview';

const PREVIEW_ITEM_COUNT = 5;
const fullBadgeClass = 'badge badge-sm border-base-content/10 bg-base-content/5 text-base-content/70';

function spaceNote(space: SaveStorageGroup['space'], t: Translator) {
    if (space === null) return t('Available space is unknown.');
    if (space.flexibleSlots > 0) return t('{count} flexible slots', { count: space.flexibleSlots });
    if (space.status === 'unusable') return t('No usable storage slots.');
    return null;
}

function StorageCard({ group }: { group: SaveStorageGroup }) {
    const { t, formatNumber } = useTranslation();
    const { tableId, visibleRows: items, toggleButton } = useCardTablePreview(group.items, PREVIEW_ITEM_COUNT);
    const names = group.cores.map(core => core.name ?? t('Core {number}', { number: core.number })).join(' + ');
    const label = group.cores.length > 1 ? t('Shared across {cores}', { cores: names }) : names || t('Unassigned Core');
    const note = spaceNote(group.space, t);

    return <article aria-label={label} className="card min-w-0 border border-base-300 bg-base-200">
        <div className="card-body gap-3 p-4">
            <header>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="min-w-0 break-words text-sm font-medium text-base-content/85">{label}</h2>
                    {group.space?.status === 'full' && <span className={fullBadgeClass}>{t('Storage full')}</span>}
                </div>
                <p className="mt-0.5 text-xs text-base-content/60">
                    {t('{count} storage buildings', { count: group.buildingCount })}
                    {group.complete && <> · {t('{count} items', { count: group.total })}</>}
                </p>
                {note && <p className="mt-1 text-xs text-base-content/75">{note}</p>}
            </header>
            {items.length > 0 && <table id={tableId} className="w-full table-fixed text-sm">
                <caption className="sr-only">{label}</caption>
                <thead className="text-xs text-base-content/60"><tr>
                    <th scope="col" className="pb-1 text-left font-normal">{t('Item')}</th>
                    <th scope="col" className="w-1/3 pb-1 pl-2 text-right font-normal">{t(group.space ? 'Stored / capacity' : 'Stored')}</th>
                </tr></thead>
                <tbody>{items.map(({ id, name, quantity, availability }) => <tr key={id} className="border-t border-base-content/10">
                    <th scope="row" className="py-2 pl-1 pr-1 text-left font-normal">
                        <span className="flex items-center gap-2">
                            <span aria-hidden="true" className="shrink-0"><ItemImage itemId={id} item={{ name }} size="xsmall" /></span>
                            <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                    <span className="break-words font-medium">{name}</span>
                                    {availability?.full && <span className={fullBadgeClass}>{t('Full')}</span>}
                                </span>
                                {availability && <span className="mt-0.5 block text-[11px] leading-tight text-base-content/65">
                                    {t('Buildings with room · {available}/{total}', { available: availability.buildingsWithRoom, total: availability.buildingCount })}
                                </span>}
                            </span>
                        </span>
                    </th>
                    <td className="py-2 pl-2 text-right tabular-nums">
                        <span className="font-semibold">{formatNumber(quantity)}</span>
                        {availability && <span className="whitespace-nowrap text-xs text-base-content/65"> / {availability.capacity === null ? '—' : formatNumber(availability.capacity)}</span>}
                    </td>
                </tr>)}</tbody>
            </table>}
            {!group.complete || !group.total ? <p className="text-xs text-base-content/65">
                {t(group.complete ? 'Storage is empty.' : 'Some storage quantities could not be read.')}
            </p> : null}
            {toggleButton}
        </div>
    </article>;
}

export function SaveStorage({ workspaceId }: { workspaceId: string }) {
    const groups = useSubscription([appIds.subscriptions.SAVES_STORAGE_GROUPS, workspaceId]);
    const { t } = useTranslation();
    if (!groups?.length) return <p className="py-10 text-center text-sm text-base-content/60">
        {t(groups === null ? 'Import the save again to see its storage quantities.' : 'No storage buildings found in this save.')}
    </p>;

    return <div className="space-y-3">
        <p className="text-xs text-base-content/65">{t('Items held in storage buildings when the game was saved.')}</p>
        {groups.every(group => group.space?.status === 'full') && <p role="status" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium">
            <span aria-hidden="true" className="text-warning">⚠</span>{t('All storage was full when the game was saved.')}
        </p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,23rem),1fr))] auto-rows-auto items-stretch gap-4">
            {groups.map(group => <StorageCard key={group.id} group={group} />)}
        </div>
    </div>;
}
