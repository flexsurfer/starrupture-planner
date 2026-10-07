import { useId, useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import type { LinkableInputItem, LinkableOutputItem } from '@/features/bases/types';
import { ConnectionCard } from './ConnectionCard';
import { connectionLabel, connectionLocationLabel, connectionReferenceLabel } from '../utils/connectionLabels';
import { getConnectionPairs } from '@/features/bases/connections';
import { useDisconnectConnections } from '../useDisconnectConnections';

export type ConnectionOption = LinkableInputItem | LinkableOutputItem;

interface ConnectionSelectorProps<T extends ConnectionOption> {
    entries: T[];
    direction: 'input' | 'output';
    onSelect: (entry: T) => void;
    emptyMessage: string;
    currentBaseId?: string;
    currentBuildingId?: string;
    disabled?: boolean;
    compact?: boolean;
    autoFocus?: boolean;
}

function ConnectionIcon({ disconnect = false }: { disconnect?: boolean }) {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        {disconnect && <path d="m2 2 20 20" />}
    </svg>;
}

export function ConnectionSelector<T extends ConnectionOption>({
    entries, direction, onSelect, emptyMessage, currentBaseId, currentBuildingId, disabled = false, compact = false, autoFocus = true,
}: ConnectionSelectorProps<T>) {
    const { t } = useTranslation();
    const confirmDisconnect = useDisconnectConnections();
    const groupId = useId();
    const [searchQuery, setSearchQuery] = useState('');
    const query = searchQuery.trim().toLowerCase();
    const filteredEntries = entries.filter(entry => !query || [
        entry.baseName, entry.name, 'description' in entry ? entry.description : '',
        entry.item?.name, entry.item?.id, entry.building.name, 'planName' in entry ? entry.planName : '',
        ...entry.connections.flatMap(connection => [connection.baseName, connection.buildingName, connection.building?.name, connection.item?.name, connection.planName]),
    ].join(' ').toLowerCase().includes(query));
    // Group the visible rows for presentation without changing the subscription's ordering.
    const groups = new Map<string, { baseName: string; isCurrentBase: boolean; entries: T[] }>();
    for (const entry of filteredEntries) {
        const group = groups.get(entry.baseId) ?? {
            baseName: entry.baseName,
            isCurrentBase: entry.baseId === currentBaseId || ('isCurrentBase' in entry && entry.isCurrentBase),
            entries: [],
        };
        group.entries.push(entry);
        groups.set(entry.baseId, group);
    }

    return <div className="@container space-y-4">
        <input type="search" aria-label={direction === 'input' ? t('Search inputs') : t('Search outputs')}
            className="input input-bordered input-sm w-full"
            placeholder={direction === 'input' ? t('Search inputs...') : t('Search outputs...')}
            value={searchQuery} onChange={event => setSearchQuery(event.target.value)} autoFocus={autoFocus} />
        <div className={compact ? 'max-h-[40vh] overflow-y-auto' : undefined}>
            {groups.size === 0 ? (
                <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/65">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-5">
                    {[...groups].map(([baseId, group]) => <section key={baseId} aria-labelledby={`${groupId}-${baseId}`}>
                        <div className="mb-2 flex min-w-0 items-center gap-2">
                            <h4 id={`${groupId}-${baseId}`} className="min-w-0 break-words text-sm font-semibold text-base-content/85">{group.baseName}</h4>
                            {group.isCurrentBase && <span className="badge badge-xs badge-outline shrink-0 text-base-content/50">{t('This base')}</span>}
                            <span className="h-px min-w-4 flex-1 bg-base-content/10" aria-hidden="true" />
                        </div>
                        <div className="space-y-2">
                            {group.entries.map(entry => {
                                const key = `${entry.baseId}:${'baseBuildingId' in entry ? entry.baseBuildingId : entry.buildingId}`;
                                const pairs = getConnectionPairs(entry);
                                const connections = entry.connections.length ? entry.connections : [null];
                                return connections.map((connection, index) => {
                                    const entryCard = <ConnectionCard name={entry.name} building={entry.building} item={entry.item}
                                        ratePerMinute={entry.ratePerMinute} baseName={entry.baseName}
                                        planName={'planName' in entry ? entry.planName : undefined} label={connectionLabel(entry, t)} />;
                                    const connectedCard = connection ? <ConnectionCard name={connection.buildingName} building={connection.building}
                                        item={connection.item} ratePerMinute={connection.ratePerMinute} baseName={connection.baseName}
                                        highlighted={connection.baseId === currentBaseId && connection.buildingId === currentBuildingId}
                                        planName={connection.planName} label={connectionReferenceLabel(connection, t)} /> : <span aria-hidden="true" />;
                                    return <div key={`${key}:${connection ? `${connection.baseId}:${connection.buildingId}` : 'free'}`}
                                    role="group" aria-label={connectionLabel(entry, t)}
                                    className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-center @lg:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)]">
                                    {direction === 'output' ? entryCard : connectedCard}
                                    <div className="relative flex items-center justify-center self-stretch">
                                        <span aria-hidden="true" className={`absolute top-1/2 h-px bg-base-content/20 ${connection ? 'left-0 w-full' : direction === 'output' ? 'left-0 w-1/2' : 'right-0 w-1/2'}`} />
                                        <button type="button"
                                            className={`btn btn-sm relative z-10 h-auto min-h-8 gap-1 rounded-md px-1.5 py-1.5 @lg:px-2 ${connection ? 'border-base-content/15 bg-base-200 text-base-content/60 hover:border-error/40 hover:text-error' : 'btn-primary btn-outline bg-base-100'}`}
                                            disabled={!connection && disabled}
                                            title={connection ? t('Disconnect {building}', { building: connectionLocationLabel(entry, t) }) : t('Connect {building}', { building: connectionLocationLabel(entry, t) })}
                                            aria-label={connection ? t('Disconnect {building}', { building: connectionLocationLabel(entry, t) }) : t('Connect {building}', { building: connectionLabel(entry, t) })}
                                            onClick={() => connection ? confirmDisconnect([pairs[index]]) : onSelect(entry)}>
                                            <ConnectionIcon disconnect={!!connection} />
                                            <span className="hidden text-[11px] @lg:inline">{connection ? t('Disconnect') : t('Connect')}</span>
                                        </button>
                                    </div>
                                    {direction === 'input' ? entryCard : connectedCard}
                                </div>;
                                });
                            })}
                        </div>
                    </section>)}
                </div>
            )}
        </div>
    </div>;
}
