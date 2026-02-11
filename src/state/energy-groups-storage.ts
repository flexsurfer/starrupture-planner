import type { EnergyGroup } from './db';

const ENERGY_GROUPS_STORAGE_KEY = 'energyGroups';
const ENERGY_GROUPS_SCHEMA_VERSION = 1 as const;

interface EnergyGroupsStorageEnvelope {
    schemaVersion: number;
    energyGroups: unknown;
}

function isEnergyGroupsStorageEnvelope(value: unknown): value is EnergyGroupsStorageEnvelope {
    if (typeof value !== 'object' || value === null) return false;

    const envelope = value as EnergyGroupsStorageEnvelope;
    return typeof envelope.schemaVersion === 'number' && 'energyGroups' in envelope;
}

function normalizeEnergyGroupName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

function normalizeEnergyGroups(raw: unknown): EnergyGroup[] {
    if (!Array.isArray(raw)) return [];

    const groups: EnergyGroup[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    for (const rawGroup of raw) {
        if (typeof rawGroup !== 'object' || rawGroup === null) continue;
        const group = rawGroup as Partial<EnergyGroup>;
        if (typeof group.id !== 'string' || typeof group.name !== 'string') continue;

        const id = group.id.trim();
        const name = normalizeEnergyGroupName(group.name);
        if (!id || !name) continue;

        const normalizedName = name.toLowerCase();
        if (seenIds.has(id) || seenNames.has(normalizedName)) continue;

        seenIds.add(id);
        seenNames.add(normalizedName);
        groups.push({ id, name });
    }

    return groups;
}

export function writeEnergyGroupsToStorage(energyGroups: EnergyGroup[]) {
    const envelope: EnergyGroupsStorageEnvelope = {
        schemaVersion: ENERGY_GROUPS_SCHEMA_VERSION,
        energyGroups,
    };

    localStorage.setItem(ENERGY_GROUPS_STORAGE_KEY, JSON.stringify(envelope));
}

export function readEnergyGroupsFromStorage(): EnergyGroup[] | null {
    const stored = localStorage.getItem(ENERGY_GROUPS_STORAGE_KEY);
    if (!stored) return null;

    const raw = JSON.parse(stored) as unknown;

    if (Array.isArray(raw)) {
        const groups = normalizeEnergyGroups(raw);
        writeEnergyGroupsToStorage(groups);
        return groups;
    }

    if (isEnergyGroupsStorageEnvelope(raw)) {
        const groups = normalizeEnergyGroups(raw.energyGroups);
        const hasNormalizationChanges = JSON.stringify(raw.energyGroups) !== JSON.stringify(groups);

        if (
            raw.schemaVersion !== ENERGY_GROUPS_SCHEMA_VERSION ||
            !Array.isArray(raw.energyGroups) ||
            hasNormalizationChanges
        ) {
            writeEnergyGroupsToStorage(groups);
        }

        return groups;
    }

    return [];
}
