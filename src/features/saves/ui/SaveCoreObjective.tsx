import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { ItemImage } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { SaveCoreObjective as Objective, SaveWorkspace } from '../types';
import type { SaveResource } from '../overview';
import { ResourceRows } from './SaveResourceRows';
import { coreKey } from '../snapshot';

export function SaveCoreObjective({ workspace, coreId, disabled, shipments }: { workspace: SaveWorkspace; coreId: number; disabled: boolean; shipments: SaveResource[] }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const saveItems = useSubscription([appIds.subscriptions.ITEMS_LIST]);
    const saveCorporations = useSubscription([appIds.subscriptions.CORPORATIONS_LIST]);
    const [search, setSearch] = useState('');
    const objective = workspace.coreSettings[coreKey(workspace.snapshot.cores.find(core => core.id === coreId)!)]?.objective;
    const setObjective = (value: Objective | null) => runtime.dispatch([appIds.events.SAVES_SET_CORE_OBJECTIVE, workspace.id, coreId, value]);
    const corporation = objective?.kind === 'corporation' ? saveCorporations.find(entry => entry.id === objective.corporationId) : null;
    const objectiveLabel = objective?.kind === 'corporation' ? t('{corporationName} Lv.{level}', { corporationName: corporation?.name ?? objective.corporationId, level: objective.level })
        : objective?.kind === 'mission' ? objective.name.trim() || t('Mission resources') : objective?.kind === 'intermediate' ? t('Intermediate resources') : t('No objective selected');
    const selectedItems = objective && objective.kind !== 'corporation' ? saveItems.filter(item => objective.itemIds.includes(item.id)) : [];
    const options = [
        { kind: 'corporation', label: t('Corporation level'), itemId: 'data_points' },
        { kind: 'intermediate', label: t('Intermediate resources'), itemId: 'bar_titanium' },
        { kind: 'mission', label: t('Mission resources'), itemId: 'electronics' },
    ] as const;
    return <section className="rounded-lg border border-base-content/10 bg-base-100/50" aria-label={t('Production objective')}><details className="group/objective">
        <summary className="cursor-pointer rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-primary">
            <span className="text-[11px] text-base-content/50">{t('Production objective')}</span>
            <span className="mt-1 block text-sm font-medium text-base-content/80">{objectiveLabel}</span>
            {selectedItems.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5">{selectedItems.map(item => <span key={item.id} className="inline-flex items-center gap-1.5 rounded-md bg-base-content/5 px-1.5 py-1 text-xs text-base-content/65">
                <ItemImage itemId={item.id} item={item} size="xsmall" /><span>{item.name}</span>
            </span>)}</span>}
        </summary>
        <div className="space-y-3 border-t border-base-content/10 p-3">
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t('Choose an objective')}>
                {options.map(option => <button type="button" key={option.kind} disabled={disabled || (option.kind === 'corporation' && !saveCorporations[0]?.levels.length)} aria-pressed={objective?.kind === option.kind} aria-label={option.label}
                    className={`flex min-w-0 flex-col items-center gap-2 rounded-lg border p-2 text-center text-[11px] leading-snug transition-colors hover:border-primary ${objective?.kind === option.kind ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200'}`}
                    onClick={() => objective?.kind !== option.kind && setObjective(option.kind === 'corporation' ? { kind: 'corporation', corporationId: saveCorporations[0].id, level: saveCorporations[0].levels[0].level }
                        : option.kind === 'intermediate' ? { kind: 'intermediate', itemIds: [] } : { kind: 'mission', name: '', itemIds: [] })}>
                    {option.kind === 'corporation' ? <img src={`${import.meta.env.BASE_URL}icons/corporations/future_health_solutions.webp`} alt="" className="size-10 object-contain" /> : <ItemImage itemId={option.itemId} size="small" />}<span>{option.label}</span>
                </button>)}
            </div>
            {objective?.kind === 'corporation' && <div className="flex flex-wrap gap-2">
                <label className="min-w-0 flex-1 text-xs text-base-content/60">{t('Corporation')}
                    <select className="select select-bordered select-sm mt-1 w-full" disabled={disabled} value={objective.corporationId}
                        onChange={event => setObjective({ ...objective, corporationId: event.target.value, level: saveCorporations.find(entry => entry.id === event.target.value)!.levels[0].level })}>
                        {!corporation && <option value={objective.corporationId}>{objective.corporationId}</option>}
                        {saveCorporations.filter(entry => entry.levels.length > 0).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                    </select>
                </label>
                <label className="w-20 text-xs text-base-content/60">{t('Level')}
                    <select className="select select-bordered select-sm mt-1 w-full" disabled={disabled} value={objective.level}
                        onChange={event => setObjective({ ...objective, level: Number(event.target.value) })}>
                        {!corporation?.levels.some(entry => entry.level === objective.level) && <option value={objective.level}>{objective.level}</option>}
                        {corporation?.levels.map(({ level }) => <option key={level} value={level}>{level}</option>)}
                    </select>
                </label>
            </div>}
            {objective?.kind === 'mission' && <label className="block text-xs text-base-content/60">{t('Mission name')}
                <input className="input input-bordered input-sm mt-1 w-full" disabled={disabled} maxLength={120} value={objective.name}
                    onChange={event => setObjective({ ...objective, name: event.target.value })} />
            </label>}
            {objective && objective.kind !== 'corporation' && <>
                <label className="block text-xs text-base-content/60">{t('Choose resources')}
                    <input type="search" className="input input-bordered input-sm mt-1 w-full" aria-label={t('Search resources')}
                        placeholder={t('Search resources')} value={search} onChange={event => setSearch(event.target.value)} />
                </label>
                <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                    {saveItems.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(item => <label key={item.id}
                        className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md bg-base-200 p-2 text-xs hover:bg-base-content/10">
                        <input type="checkbox" className="checkbox checkbox-xs" aria-label={item.name} disabled={disabled} checked={objective.itemIds.includes(item.id)}
                            onChange={event => setObjective({ ...objective, itemIds: event.target.checked ? [...objective.itemIds, item.id] : objective.itemIds.filter(id => id !== item.id) })} />
                        <ItemImage itemId={item.id} item={item} size="xsmall" /><span className="min-w-0 break-words">{item.name}</span>
                    </label>)}
                </div>
            </>}
            {objective && <button type="button" className="btn btn-ghost btn-xs" disabled={disabled} onClick={() => setObjective(null)}>{t('Clear objective')}</button>}
        </div>
    </details>
        {shipments.length > 0 && <div className="border-t border-base-content/10 px-3 py-1">
            <p className="pt-2 text-[11px] text-base-content/50">{t('Sent to corporations')}</p>
            <ResourceRows resources={shipments} />
        </div>}
    </section>;
}
