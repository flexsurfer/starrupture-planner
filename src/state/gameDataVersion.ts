export type DataVersion = 'earlyaccess' | 'playtest' | 'update1_PTB' | 'update1';

export const DATA_VERSIONS: { id: DataVersion; label: string }[] = [
    { id: 'earlyaccess', label: 'Early Access' },
    { id: 'playtest', label: 'Playtest' },
    { id: 'update1_PTB', label: 'Update 1 PTB' },
    { id: 'update1', label: 'Update 1' },
];

export const DEFAULT_DATA_VERSION: DataVersion = 'update1';

const VALID_VERSIONS = new Set<DataVersion>(DATA_VERSIONS.map((v) => v.id));

export function isValidDataVersion(value: string | null | undefined): value is DataVersion {
    return value !== null && value !== undefined && VALID_VERSIONS.has(value as DataVersion);
}
