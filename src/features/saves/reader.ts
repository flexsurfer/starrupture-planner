import { SaveImportError } from './import-error';
import { MAX_SAVE_BYTES } from './import-limits';
export { MAX_SAVE_BYTES } from './import-limits';

/** File handles and bytes stay outside application state and persistence. */
export interface SaveFileSource {
    readonly name: string;
    readonly size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export function validateSaveFile(file: Pick<SaveFileSource, 'name' | 'size'>): void {
    if (!/\.sav$/i.test(file.name)) throw new SaveImportError('extension');
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_SAVE_BYTES) throw new SaveImportError('file-size');
    if (file.size < 6) throw new SaveImportError('compression');
}

/** Validate and read a file. This module knows nothing about the save's contents. */
export async function readSaveFile(file: SaveFileSource, signal?: AbortSignal): Promise<ArrayBuffer> {
    signal?.throwIfAborted();
    validateSaveFile(file);
    let bytes: ArrayBuffer;
    try { bytes = await file.arrayBuffer(); }
    catch { signal?.throwIfAborted(); throw new SaveImportError('read'); }
    signal?.throwIfAborted();
    if (bytes.byteLength !== file.size) throw new SaveImportError('read');
    return bytes;
}
