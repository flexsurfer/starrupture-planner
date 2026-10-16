import { useId, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui';
import { isValidResourceRate, type PlannerResourcePicker } from '../../resources';

interface CoreResourcePickerProps {
    workspaceId: string;
    onDone: () => void;
    focusItemId?: string;
}

export function CoreResourcePicker(props: CoreResourcePickerProps) {
    const picker = useSubscription([appIds.subscriptions.PLANNER_RESOURCE_PICKER, props.workspaceId]);
    return picker && <PickerContents key={`${picker.workspaceId}:${picker.snapshotKey}`} {...props} data={picker} />;
}

function PickerContents({ data, onDone, focusItemId }: CoreResourcePickerProps & { data: PlannerResourcePicker }) {
    const { t, formatNumber } = useTranslation();
    const runtime = useRuntime();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const queryId = useId();
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const selectedRows = data.cores.flatMap(core => core.buildings).filter(building => selected[building.buildingId] && !building.alreadyAdded && !building.isTarget);
    const allocations = selectedRows.map(building => ({ buildingId: building.buildingId, ratePerMinute: Number(amounts[building.buildingId] ?? building.capacity ?? '') }));
    const valid = data.compatible && allocations.length > 0 && allocations.every(allocation => isValidResourceRate(allocation.ratePerMinute));
    const visibleCores = data.cores.map(core => ({
        ...core,
        buildings: core.buildings.filter(building => (!focusItemId || building.itemId === focusItemId)
            && (!normalizedQuery || `${core.name} ${building.itemName} ${building.buildingName}`.toLocaleLowerCase().includes(normalizedQuery))),
    })).filter(core => core.buildings.length > 0);
    return <>
        <div className="shrink-0 space-y-2 px-4 py-3">
            {!data.compatible && <p role="status" className="text-xs text-warning">{t('Resources from cores are unavailable for this game version.')}</p>}
            <label className="sr-only" htmlFor={queryId}>{t('Search resources, buildings, or cores')}</label>
            <input id={queryId} type="search" className="input input-bordered input-sm w-full" value={query}
                placeholder={t('Search resources, buildings, or cores')} onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {!visibleCores.length && <p className="py-3 text-sm text-base-content/60">{t('No matching resources.')}</p>}
            {visibleCores.map(core => {
                const selectable = core.buildings.filter(building => !building.isTarget && !building.alreadyAdded);
                const allSelected = selectable.length > 0 && selectable.every(building => selected[building.buildingId]);
                const someSelected = selectable.some(building => selected[building.buildingId]);
                return <section key={core.coreKey} className="mb-3">
                    <label className="sticky top-0 z-10 flex cursor-pointer items-center gap-2 border-b border-base-300 bg-base-100 py-2 text-xs font-semibold">
                        <input type="checkbox" className="checkbox checkbox-xs" disabled={!data.compatible || !selectable.length}
                            ref={element => { if (element) element.indeterminate = someSelected && !allSelected; }}
                            aria-label={t('Select all in {core}', { core: core.name })} checked={allSelected}
                            onChange={event => {
                                const checked = event.target.checked;
                                setSelected(previous => ({ ...previous, ...Object.fromEntries(selectable.map(building => [building.buildingId, checked])) }));
                            }} />
                        <span className="min-w-0 flex-1 truncate">{core.name}</span>
                        <span className="font-normal text-base-content/45">{t('/min')}</span>
                    </label>
                    <div className="divide-y divide-base-300/50">
                        {core.buildings.map(building => {
                            const checked = !!selected[building.buildingId];
                            const disabled = !data.compatible || building.isTarget || building.alreadyAdded;
                            return <div key={building.buildingId} className={`flex items-center gap-2 py-2 ${disabled ? 'opacity-45' : ''}`}>
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                                    <input type="checkbox" className="checkbox checkbox-xs shrink-0" checked={checked || building.alreadyAdded} disabled={disabled}
                                        aria-label={t('Select {item} from {building}', { item: building.itemName, building: building.buildingName })}
                                        onChange={event => setSelected(previous => ({ ...previous, [building.buildingId]: event.target.checked }))} />
                                    <ItemImage itemId={building.itemId} size="xsmall" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm">{building.itemName}</span>
                                        <span className="block truncate text-xs text-base-content/50" title={building.buildingName}>{building.buildingName}</span>
                                    </span>
                                </label>
                                {building.isTarget || building.alreadyAdded ? <span className="text-xs text-base-content/60">{building.isTarget ? t('Plan target') : t('Already added')}</span>
                                    : checked ? <input type="number" min="0.0001" max="1000000000" step="any" required
                                        className="input input-bordered input-sm w-22 shrink-0 px-2 text-right tabular-nums"
                                        aria-label={t('Amount for {item} from {building}', { item: building.itemName, building: building.buildingName })}
                                        value={amounts[building.buildingId] ?? building.capacity ?? ''} placeholder="—"
                                        onChange={event => setAmounts(previous => ({ ...previous, [building.buildingId]: event.target.value }))} />
                                        : <span className="w-22 shrink-0 pr-2 text-right text-sm tabular-nums text-base-content/65">{building.capacity === null ? '—' : formatNumber(building.capacity, { maximumFractionDigits: 2 })}</span>}
                            </div>;
                        })}
                    </div>
                </section>;
            })}
        </div>
        <div className="shrink-0 border-t border-base-300 p-4">
            {selectedRows.some(building => building.capacity === null) && <p className="mb-2 text-xs text-base-content/60">{t('Enter an amount for resources with unknown capacity.')}</p>}
            <button type="button" className="btn btn-primary btn-sm w-full" disabled={!valid} onClick={() => {
                if (!valid) return;
                runtime.dispatch([appIds.events.PLANNER_IMPORT_CORE_RESOURCES, data.workspaceId, data.snapshotKey, allocations]);
                onDone();
            }}>{t('Add selected resources')}{selectedRows.length > 0 && <span className="badge badge-sm border-0 bg-white/15 text-inherit">{selectedRows.length}</span>}</button>
        </div>
    </>;
}
