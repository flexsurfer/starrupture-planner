export type SaveImportErrorCode = 'selection' | 'extension' | 'file-size' | 'decoded-size' | 'compression'
    | 'size-mismatch' | 'structure' | 'complexity' | 'unsupported-browser' | 'read' | 'timeout'
    | 'catalog' | 'mapping-version' | 'mappings' | 'core-identity' | 'position' | 'transport';
export class SaveImportError extends Error {
    readonly code: SaveImportErrorCode;
    constructor(code: SaveImportErrorCode) { super(code); this.code = code; }
}
