import { analyzeSave } from './analyze';
import { SaveImportError } from '../import-error';
import type { SaveDecodeContext } from './types';
import type { SaveSnapshot } from '../snapshot';
import { MAX_SAVE_BYTES, MAX_DECODED_SAVE_BYTES } from '../import-limits';
export { SaveImportError } from '../import-error';

export { MAX_DECODED_SAVE_BYTES } from '../import-limits';

/** The observed container is uint32 LE decoded length followed by zlib UTF-8 JSON. */
export async function decodeSave(bytes: ArrayBuffer, context: SaveDecodeContext, signal?: AbortSignal): Promise<SaveSnapshot> {
    signal?.throwIfAborted();
    if (bytes.byteLength > MAX_SAVE_BYTES) throw new SaveImportError('file-size');
    if (bytes.byteLength < 6) throw new SaveImportError('compression');
    const declaredSize = new DataView(bytes).getUint32(0, true);
    if (declaredSize > MAX_DECODED_SAVE_BYTES) throw new SaveImportError('decoded-size');
    if (!declaredSize) throw new SaveImportError('compression');
    if (typeof DecompressionStream === 'undefined') throw new SaveImportError('unsupported-browser');

    let text: string;
    let decodedSize = 0;
    try {
        const reader = new Blob([bytes.slice(4)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const parts: string[] = [];
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
                parts.push(decoder.decode(chunk.value, { stream: true }));
            }
            parts.push(decoder.decode());
        } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
        text = parts.join('');
    } catch (error) {
        signal?.throwIfAborted();
        throw error instanceof SaveImportError ? error : new SaveImportError('compression');
    }
    if (decodedSize !== declaredSize) throw new SaveImportError('size-mismatch');
    signal?.throwIfAborted();
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { throw new SaveImportError('structure'); }
    return analyzeSave(json, context);
}
