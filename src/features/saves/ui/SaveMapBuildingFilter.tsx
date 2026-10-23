import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { BuildingImage } from '@/shared/ui';
import type { MapBuildingCategory } from '../map-filter';
import { SaveMapIcon } from './SaveMapIcon';

const categoryLabels = {
    extractor: 'Extractors', production: 'Production', transport: 'Transport', storage: 'Storage',
    generator: 'Power', temperature: 'Heat', other: 'Other',
} as const satisfies Record<MapBuildingCategory, MessageKey>;

export function SaveMapBuildingFilter({ workspaceId }: { workspaceId: string }) {
    const { t, formatNumber } = useTranslation();
    const runtime = useRuntime();
    const options = useSubscription([appIds.subscriptions.SAVES_MAP_BUILDING_TYPES, workspaceId]);
    const selected = useSubscription([appIds.subscriptions.SAVES_MAP_BUILDING_FILTER, workspaceId]);
    const id = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const trigger = useRef<HTMLButtonElement>(null);
    const container = useRef<HTMLDivElement>(null);
    const setSelected = (ids: string[] | null) => runtime.dispatch([appIds.events.SAVES_SET_MAP_BUILDING_FILTER, workspaceId, ids]);
    const allSelected = selected.length === options.length;
    const label = allSelected ? t('All buildings') : selected.length
        ? t('Building types ({count})', { count: selected.length }) : t('No buildings');
    const results = options.filter(option => option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside, true);
        return () => document.removeEventListener('pointerdown', closeOutside, true);
    }, [open]);

    return <div ref={container} className="save-map-filter" onBlur={event => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next) && !next.contains(event.currentTarget)) setOpen(false);
    }} onKeyDown={event => {
        if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
        }
    }}>
        <button ref={trigger} type="button" className={`save-map-filter-trigger btn btn-sm ${allSelected ? '' : 'btn-active'}`}
            aria-label={t('Filter buildings')} aria-expanded={open} aria-controls={id}
            aria-description={label}
            onClick={() => { setOpen(!open); setQuery(''); }}>
            <SaveMapIcon name="filter" />
            {label}
            <SaveMapIcon name="down" />
        </button>
        {open && <div id={id} className="save-map-filter-panel" role="group" aria-label={t('Building types')}>
            <div className="save-map-filter-heading">
                <strong>{t('Building types')}</strong>
                <div className="save-map-filter-actions">
                    <button type="button" className="btn btn-ghost btn-xs" disabled={allSelected}
                        onClick={() => setSelected(null)}>{t('Select all')}</button>
                    <button type="button" className="btn btn-ghost btn-xs" disabled={!selected.length}
                        onClick={() => setSelected([])}>{t('Hide all')}</button>
                </div>
            </div>
            <p id={`${id}-hint`}>{t('Deselect building types to hide them. Use Hide all to start with an empty selection.')}</p>
            <input type="search" className="input input-sm" autoFocus autoComplete="off" value={query}
                aria-label={t('Search building types')} placeholder={t('Search building types')}
                onChange={event => setQuery(event.target.value)} />
            <div className="save-map-filter-options" aria-describedby={`${id}-hint`}>
                {results.map((option, index) => <Fragment key={option.id}>
                    {results[index - 1]?.category !== option.category &&
                        <h3 className="save-map-filter-category">{t(categoryLabels[option.category])}</h3>}
                    <label>
                        <input type="checkbox" className="checkbox checkbox-sm" checked={selected.includes(option.id)}
                            aria-label={option.name} onChange={event => setSelected(event.target.checked
                                ? [...selected, option.id] : selected.filter(id => id !== option.id))} />
                        <BuildingImage buildingId={option.id} building={{ name: option.name }} size="xsmall" />
                        <span>{option.name}</span><small>{formatNumber(option.count)}</small>
                    </label>
                </Fragment>)}
                {!results.length && <p role="status">{t('No buildings found.')}</p>}
            </div>
        </div>}
    </div>;
}
