export type SaveImportErrorCode = 'selection' | 'extension' | 'file-size' | 'decoded-size' | 'compression'
    | 'size-mismatch' | 'structure' | 'complexity' | 'unsupported-browser' | 'read' | 'timeout'
    | 'catalog' | 'mapping-version' | 'mappings' | 'core-identity' | 'position' | 'transport';

/** Stable diagnostic IDs and counters only; never include source keys, names or fragments. */
export interface SaveImportDiagnostic {
    subcode: 'json-token-chars' | 'json-key-chars' | 'json-active-key-chars' | 'json-object-keys'
        | 'json-container-separators' | 'json-depth' | 'json-record-chars' | 'projection-chars'
        | 'entity-records' | 'power-network-records' | 'custom-name-records' | 'core-level-records' | 'transport-records'
        | 'entity-asset-chars' | 'entity-fragment-count' | 'entity-fragment-chars'
        | 'building-name-chars' | 'timestamp-chars' | 'transport-item-chars' | 'building-core-comparisons';
    actual: number;
    limit: number;
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
        if (code === 'complexity' && diagnostic) this.diagnostic = { ...diagnostic };
    }
}

export function assertSaveImportLimit(subcode: SaveImportDiagnostic['subcode'], actual: number, limit: number): void {
    if (actual > limit) throw new SaveImportError('complexity', { subcode, actual, limit });
}

/** Plain, detached data survives worker delivery and can enter transient application state. */
export function saveImportFailure(error: unknown): SaveImportFailure {
    return error instanceof SaveImportError
        ? { error: error.code, ...(error.diagnostic ? { diagnostic: { ...error.diagnostic } } : {}) }
        : { error: 'read' };
}
