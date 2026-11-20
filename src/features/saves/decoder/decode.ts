import { analyzeSave } from './analyze';
import { createSaveJsonParser } from './stream-json';
import { SaveImportError, type SaveImportDecodeDiagnostic } from '../import-error';
import type { SaveDecodeContext } from './types';
import type { SaveSnapshot } from '../snapshot';
import { MAX_SAVE_BYTES, MAX_DECODED_SAVE_BYTES } from '../import-limits';
export { SaveImportError } from '../import-error';

export { MAX_DECODED_SAVE_BYTES } from '../import-limits';

/** The observed container is uint32 LE decoded length followed by zlib UTF-8 JSON. */
export async function decodeSave(source: ArrayBuffer | Blob, context: SaveDecodeContext, signal?: AbortSignal): Promise<SaveSnapshot> {
    signal?.throwIfAborted();
    const size = source instanceof ArrayBuffer ? source.byteLength : source.size;
    if (size > MAX_SAVE_BYTES) throw new SaveImportError('file-size');
    const blob = source instanceof ArrayBuffer ? new Blob([source]) : source;
    let phase: SaveImportDecodeDiagnostic['phase'] = 'header';
    let declaredSize: number | undefined;
    let decodedSize = 0;
    try {
        if (size < 6) throw new SaveImportError('format');
        let header: ArrayBuffer;
        try { header = await blob.slice(0, 6).arrayBuffer(); }
        catch { throw new SaveImportError('read'); }
        signal?.throwIfAborted();
        if (header.byteLength !== 6) throw new SaveImportError('read');
        const bytes = new Uint8Array(header);
        const [cmf, flg] = [bytes[4], bytes[5]];
        // RFC 1950: DEFLATE, window <= 32 KiB, header checksum, no preset dictionary.
        // Validate these before treating arbitrary leading bytes as a declared length.
        if ((cmf & 15) !== 8 || (cmf >> 4) > 7 || ((cmf << 8) | flg) % 31 !== 0 || (flg & 32) !== 0) {
            throw new SaveImportError('format');
        }
        declaredSize = new DataView(header).getUint32(0, true);
        if (!declaredSize) throw new SaveImportError('size-header');
        if (declaredSize > MAX_DECODED_SAVE_BYTES) throw new SaveImportError('declared-size');
        if (typeof DecompressionStream === 'undefined') throw new SaveImportError('unsupported-browser');

        const parser = createSaveJsonParser(context);
        phase = 'decompression';
        const reader = blob.slice(4).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
        const abort = () => { void reader.cancel().catch(() => {}); };
        signal?.addEventListener('abort', abort, { once: true });
        try {
            while (true) {
                phase = 'decompression';
                signal?.throwIfAborted();
                const chunk = await reader.read();
                signal?.throwIfAborted();
                if (chunk.done) break;
                decodedSize += chunk.value.byteLength;
                // Check actual output too: the header is untrusted, not a memory budget.
                if (decodedSize > MAX_DECODED_SAVE_BYTES) throw new SaveImportError('decoded-size');
                if (decodedSize > declaredSize) throw new SaveImportError('size-mismatch');
                phase = 'parse';
                parser.write(chunk.value);
            }
        } finally {
            signal?.removeEventListener('abort', abort);
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
        if (decodedSize !== declaredSize) throw new SaveImportError('size-mismatch');
        signal?.throwIfAborted();
        phase = 'parse';
        const save = parser.end();
        phase = 'analysis';
        return analyzeSave(save, context);
    } catch (error) {
        signal?.throwIfAborted();
        throw new SaveImportError(error instanceof SaveImportError ? error.code : 'compression', {
            ...(error instanceof SaveImportError ? error.diagnostic : undefined),
            phase, ...(declaredSize !== undefined ? { declaredBytes: declaredSize } : {}),
            decodedBytes: decodedSize, decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
        });
    }
}
