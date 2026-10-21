import { analyzeSave } from './analyze';
import { createSaveJsonParser } from './stream-json';
import { SaveImportError } from '../import-error';
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
    if (size < 6) throw new SaveImportError('compression');
    const blob = source instanceof ArrayBuffer ? new Blob([source]) : source;
    let header: ArrayBuffer;
    try { header = await blob.slice(0, 4).arrayBuffer(); }
    catch { signal?.throwIfAborted(); throw new SaveImportError('read'); }
    signal?.throwIfAborted();
    const declaredSize = new DataView(header).getUint32(0, true);
    if (declaredSize > MAX_DECODED_SAVE_BYTES) throw new SaveImportError('decoded-size');
    if (!declaredSize) throw new SaveImportError('compression');
    if (typeof DecompressionStream === 'undefined') throw new SaveImportError('unsupported-browser');

    const parser = createSaveJsonParser(context);
    let decodedSize = 0;
    try {
        const reader = blob.slice(4).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
        const abort = () => { void reader.cancel().catch(() => {}); };
        signal?.addEventListener('abort', abort, { once: true });
        try {
            while (true) {
                signal?.throwIfAborted();
                const chunk = await reader.read();
                signal?.throwIfAborted();
                if (chunk.done) break;
                decodedSize += chunk.value.byteLength;
                // Check actual output too: the header is untrusted, not a memory budget.
                if (decodedSize > MAX_DECODED_SAVE_BYTES) throw new SaveImportError('decoded-size');
                if (decodedSize > declaredSize) throw new SaveImportError('size-mismatch');
                parser.write(chunk.value);
            }
        } finally {
            signal?.removeEventListener('abort', abort);
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
    } catch (error) {
        signal?.throwIfAborted();
        throw error instanceof SaveImportError ? error : new SaveImportError('compression');
    }
    if (decodedSize !== declaredSize) throw new SaveImportError('size-mismatch');
    signal?.throwIfAborted();
    return analyzeSave(parser.end(), context);
}
