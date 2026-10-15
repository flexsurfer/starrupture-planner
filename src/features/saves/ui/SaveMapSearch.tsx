import { useId, useMemo, useRef, useState } from 'react';
import { BuildingImage } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { SaveMapEntity } from '../map';
import { SaveMapIcon } from './SaveMapIcon';

const resultLimit = 100;

export function SaveMapSearch({ entities, entityName, coreName, onSelect }: {
    entities: SaveMapEntity[]; entityName: (entity: SaveMapEntity) => string;
    coreName: (entity: SaveMapEntity) => string; onSelect: (id: number) => void;
}) {
    const { t } = useTranslation();
    const id = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const list = useRef<HTMLUListElement>(null);
    const entries = useMemo(() => entities.map(entity => {
        const name = entityName(entity), core = coreName(entity);
        return { entity, name, core, search: [name, core, `#${entity.id}`, entity.detail?.building.name,
            ...entity.detail?.resources.map(resource => resource.name) ?? []].join(' ').toLocaleLowerCase() };
    }), [entities, entityName, coreName]);
    const matches = useMemo(() => {
        const words = query.trim().toLocaleLowerCase().split(/\s+/);
        return entries.filter(entry => words.every(word => entry.search.includes(word)));
    }, [entries, query]);
    const results = matches.slice(0, resultLimit);
    const active = Math.min(activeIndex, results.length - 1);
    const choose = (entity: SaveMapEntity) => {
        onSelect(entity.id);
        setQuery('');
        setOpen(false);
    };
    const move = (index: number) => {
        const next = Math.max(0, Math.min(results.length - 1, index));
        setActiveIndex(next);
        list.current?.children[next]?.scrollIntoView?.({ block: 'nearest' });
    };

    return <div className="save-map-search" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
        <SaveMapIcon name="search" />
        <input role="combobox" type="search" aria-label={t('Find a building')} placeholder={t('Find a building')}
            aria-expanded={open} aria-controls={`${id}-results`} aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${id}-${results[active].entity.id}` : undefined}
            autoComplete="off" value={query} onFocus={() => setOpen(true)}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
            onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setOpen(true);
                    move(open ? active + (event.key === 'ArrowDown' ? 1 : -1) : 0);
                } else if (event.key === 'Enter' && open && active >= 0) {
                    event.preventDefault();
                    choose(results[active].entity);
                } else if (event.key === 'Escape') {
                    event.stopPropagation();
                    setOpen(false);
                }
            }} />
        {open && <div className="save-map-search-popover">
            <ul id={`${id}-results`} ref={list} role="listbox" aria-label={t('Buildings')}>
                {results.map((entry, index) => <li key={entry.entity.id} role="presentation">
                    <button type="button" role="option" id={`${id}-${entry.entity.id}`} tabIndex={-1}
                        aria-label={`${entry.name} · ${entry.core} · #${entry.entity.id}`}
                        aria-selected={index === active} onMouseDown={event => event.preventDefault()}
                        onClick={() => choose(entry.entity)} onPointerMove={() => setActiveIndex(index)}>
                        <BuildingImage buildingId={entry.entity.detail?.building.id ?? 'base_core'} building={{ name: entry.name }} size="small" />
                        <span className="save-map-search-name"><span>{entry.name}</span><small>{entry.core} · #{entry.entity.id}</small></span>
                    </button>
                </li>)}
            </ul>
            {results.length === 0 && <p role="status">{t('No buildings found.')}</p>}
            {matches.length > resultLimit && <p role="status">{t('Showing {count} of {total} buildings. Refine your search.', {
                count: resultLimit, total: matches.length,
            })}</p>}
        </div>}
    </div>;
}
