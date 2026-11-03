import { useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { useTranslation, type Translator } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui';
import type { SaveStorageGroup } from '../storage-inventory';
import { useCardTablePreview } from './useCardTablePreview';

const PREVIEW_ITEM_COUNT = 5;

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

    return <article aria-label={label} className="card min-w-0 bg-base-200">
        <div className="card-body gap-3 p-4">
            <header>
                <h2 className="wrap-anywhere text-sm font-medium text-base-content/80">{label}</h2>
                <p className="mt-0.5 text-[11px] text-base-content/55">
                    {t('{count} storage buildings', { count: group.buildingCount })}
                    {group.complete && <> · {t('{count} items', { count: group.total })}</>}
                </p>
                {note && <p className="mt-1 text-xs text-base-content/70">{note}</p>}
            </header>
            {items.length > 0 && <table id={tableId} className="save-report-table">
                <caption className="sr-only">{label}</caption>
                <thead><tr>
                    <th scope="col" className="text-left">{t('Item')}</th>
                    {group.space && <th scope="col" className="w-[22%] text-center">{t('Buildings with room')}</th>}
                    <th scope="col" className="w-1/3 text-right">{t(group.space ? 'Stored / capacity' : 'Stored')}</th>
                </tr></thead>
                <tbody>{items.map(({ id, name, quantity, availability }) => <tr key={id}>
                    <th scope="row" className="text-left font-medium text-base-content/85">
                        <span className="flex items-center gap-2">
                            <span aria-hidden="true" className="shrink-0"><ItemImage itemId={id} item={{ name }} size="small" /></span>
                            <span>{name}</span>
                        </span>
                    </th>
                    {group.space && <td className="text-center text-base-content/70">
                        {availability ? <>{formatNumber(availability.buildingsWithRoom)}/{formatNumber(availability.buildingCount)}</> : '—'}
                    </td>}
                    <td className="text-right">
                        <span className="font-medium">{formatNumber(quantity)}</span>
                        {availability && <> <span className="inline-block max-w-full text-[11px] text-base-content/65">/ {availability.capacity === null ? '—' : formatNumber(availability.capacity)}</span></>}
                        {availability?.capacity != null && availability.capacity > 0 && <progress aria-hidden="true" value={quantity} max={availability.capacity}
                            className={`progress mt-1 ml-auto block h-1 max-w-24 ${availability.full ? 'progress-warning' : 'progress-success'}`} />}
                    </td>
                </tr>)}</tbody>
            </table>}
            {(!group.complete || !group.total) && <p className={`text-xs ${group.complete ? 'text-base-content/65' : 'text-(--save-warning-ink)'}`}>
                {t(group.complete ? 'Storage is empty.' : 'Some storage quantities could not be read.')}
            </p>}
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
    return <div className="save-report space-y-3">
        {groups.every(group => group.space?.status === 'full') && <p role="status" className="flex items-center gap-2 text-xs text-(--save-warning-ink)">
            <span aria-hidden="true">⚠</span>{t('All storage was full when the game was saved.')}
        </p>}
        <div className="save-report-grid">
            {groups.map(group => <StorageCard key={group.id} group={group} />)}
        </div>
    </div>;
}
