import type { Building, Item } from '@/app/uklad/model';
import type { Translator } from '@/shared/i18n';
import type { ConnectionReference } from '@/features/bases/types';

interface ConnectionLabelEntry {
    baseName: string;
    building: Pick<Building, 'name'>;
    name?: string;
    item?: Pick<Item, 'name'>;
    ratePerMinute?: number;
}

export function connectionReferenceLabel(connection: ConnectionReference, t: Translator): string {
    return t('{base} / {building}', { base: connection.baseName || t('Missing base'), building: connection.buildingName });
}

export function connectionStatusLabel(connections: ConnectionReference[], t: Translator): string {
    return connections.length ? t('Connected to {connections}. Disconnect first.', {
        connections: connections.map(connection => connectionReferenceLabel(connection, t)).join('; '),
    }) : '';
}

export function connectionBuildingLabel(entry: ConnectionLabelEntry): string {
    return entry.name && entry.name !== entry.building.name
        ? `${entry.building.name} (${entry.name})` : entry.building.name;
}

/** Prioritize the base and building name in the compact, selected value. */
export function connectionLocationLabel(entry: ConnectionLabelEntry, t: Translator): string {
    return t('{base} / {building}', {
        base: entry.baseName,
        building: entry.name || entry.building.name,
    });
}

/** Keep source and target choices understandable in every linking control. */
export function connectionLabel(entry: ConnectionLabelEntry, t: Translator): string {
    return t('{material} · {rate} — {building} — {base}', {
        material: entry.item?.name || t('No material configured'),
        rate: typeof entry.ratePerMinute === 'number' && Number.isFinite(entry.ratePerMinute)
            ? t('{value}/min', { value: Math.round(entry.ratePerMinute * 10) / 10 }) : t('No rate configured'),
        building: connectionBuildingLabel(entry),
        base: entry.baseName,
    });
}
