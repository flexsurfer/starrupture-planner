export type DataVersion = 'earlyaccess' | 'playtest' | 'update1_PTB' | 'update1' | 'update2_QoL';

export const DATA_VERSIONS: { id: DataVersion; label: string; saveMappings?: boolean }[] = [
    { id: 'earlyaccess', label: 'Early Access' },
    { id: 'playtest', label: 'Playtest' },
    { id: 'update1_PTB', label: 'Update 1 PTB' },
    { id: 'update1', label: 'Update 1' },
    { id: 'update2_QoL', label: 'Update 2 QoL', saveMappings: true },
];

export const DEFAULT_DATA_VERSION: DataVersion = 'update2_QoL';

const VALID_VERSIONS = new Set<DataVersion>(DATA_VERSIONS.map((v) => v.id));

export function isValidDataVersion(value: string | null | undefined): value is DataVersion {
    return value !== null && value !== undefined && VALID_VERSIONS.has(value as DataVersion);
}

/** Availability of exported save mappings; never substitute another version's identities. */
export const hasSaveMappings = (version: DataVersion) => DATA_VERSIONS.some(entry => entry.id === version && entry.saveMappings);
