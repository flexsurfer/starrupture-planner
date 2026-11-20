export type SaveImportErrorCode = 'selection' | 'extension' | 'file-size' | 'format' | 'size-header' | 'declared-size' | 'decoded-size' | 'compression'
    | 'size-mismatch' | 'structure' | 'complexity' | 'unsupported-browser' | 'read' | 'timeout'
    | 'catalog' | 'mapping-version' | 'mappings' | 'core-identity' | 'position' | 'transport';

/** Stable diagnostic IDs and counters only; never include source keys, names or fragments. */
export interface SaveImportComplexityDiagnostic {
    subcode: 'json-token-chars' | 'json-key-chars' | 'json-active-key-chars' | 'json-object-keys'
        | 'json-container-separators' | 'json-depth' | 'json-record-chars' | 'projection-chars'
        | 'entity-records' | 'power-network-records' | 'custom-name-records' | 'core-level-records' | 'transport-records'
        | 'entity-asset-chars' | 'entity-fragment-count' | 'entity-fragment-chars'
        | 'building-name-chars' | 'timestamp-chars' | 'transport-item-chars' | 'building-core-comparisons';
    actual: number;
    limit: number;
}

export interface SaveImportDecodeDiagnostic {
    phase: 'header' | 'decompression' | 'parse' | 'analysis';
    /** Present only after the container header has been recognized. Still untrusted. */
    declaredBytes?: number;
    /** Bytes observed so far, not necessarily the complete unpacked file. */
    decodedBytes: number;
    decodedLimitBytes: number;
}

export type SaveImportDiagnostic = SaveImportDecodeDiagnostic
    | (SaveImportComplexityDiagnostic & Partial<SaveImportDecodeDiagnostic>);

const byteCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Detach only known diagnostic fields; discard stale complexity counters for other errors. */
export function copySaveImportDiagnostic(error: string, diagnostic?: SaveImportDiagnostic | null): SaveImportDiagnostic | undefined {
    if (!diagnostic) return;
    const measurements = diagnostic.phase && ['header', 'decompression', 'parse', 'analysis'].includes(diagnostic.phase)
        && byteCount(diagnostic.decodedBytes) && byteCount(diagnostic.decodedLimitBytes) && diagnostic.decodedLimitBytes > 0
        ? { phase: diagnostic.phase, decodedBytes: diagnostic.decodedBytes, decodedLimitBytes: diagnostic.decodedLimitBytes,
            ...(byteCount(diagnostic.declaredBytes)
                ? { declaredBytes: diagnostic.declaredBytes } : {}) } : undefined;
    if (error === 'complexity' && 'subcode' in diagnostic) {
        return { subcode: diagnostic.subcode, actual: diagnostic.actual, limit: diagnostic.limit, ...measurements };
    }
    return measurements;
}

/** Shared allowlist for analytics and copyable reports. Never include filenames or raw headers. */
export function saveImportDiagnosticData(error: string, diagnostic?: SaveImportDiagnostic | null): Record<string, string | number> {
    const selected = copySaveImportDiagnostic(error, diagnostic);
    const data: Record<string, string | number> = {};
    if (!selected) return data;
    if ('subcode' in selected) Object.assign(data, { subcode: selected.subcode, actual: selected.actual, limit: selected.limit });
    if (selected.phase) data.decode_phase = selected.phase;
    if (selected.declaredBytes !== undefined) data.declared_bytes = selected.declaredBytes;
    if (selected.decodedBytes !== undefined) data.decoded_bytes = selected.decodedBytes;
    if (selected.decodedLimitBytes !== undefined) data.decoded_limit_bytes = selected.decodedLimitBytes;
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) delete data[key];
    }
    return data;
}

export interface SaveImportFailure {
    error: SaveImportErrorCode;
    diagnostic?: SaveImportDiagnostic;
}

export class SaveImportError extends Error {
    readonly code: SaveImportErrorCode;
    readonly diagnostic?: SaveImportDiagnostic;
    constructor(code: SaveImportErrorCode, diagnostic?: SaveImportDiagnostic) {
        super(code);
        this.code = code;
        this.diagnostic = copySaveImportDiagnostic(code, diagnostic);
    }
}

export function assertSaveImportLimit(subcode: SaveImportComplexityDiagnostic['subcode'], actual: number, limit: number): void {
    if (actual > limit) throw new SaveImportError('complexity', { subcode, actual, limit });
}

/** Plain, detached data survives worker delivery and can enter transient application state. */
export function saveImportFailure(error: unknown): SaveImportFailure {
    return error instanceof SaveImportError
        ? { error: error.code, ...(error.diagnostic ? { diagnostic: { ...error.diagnostic } } : {}) }
        : { error: 'read' };
}
