import { readSaveFile, validateSaveFile } from '@/features/saves/reader';
import { SaveImportError } from '@/features/saves/import-error';
import { SAVE_IMPORT_TIMEOUT_MS } from '@/features/saves/import-limits';
import type { SaveImportDecoder } from '@/platform/shared/save-import-effects';
import type { SaveWorkerInput, SaveWorkerResult } from './save-import-worker';

/** File IO, inflate, and JSON parsing have a bounded lifetime; parsing runs off the UI thread. */
export const readSaveInWorker: SaveImportDecoder = (request, signal) => new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') { reject(new SaveImportError('unsupported-browser')); return; }
    let worker: Worker | null = null;
    let finished = false;
    const finish = (result?: SaveWorkerResult) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        worker?.terminate();
        if (result && 'report' in result) resolve(result.report);
        else reject(new SaveImportError(result && 'error' in result ? result.error : 'read'));
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish({ error: 'timeout' }), SAVE_IMPORT_TIMEOUT_MS);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    const start = (input: SaveWorkerInput) => {
        if (finished) return;
        worker = new Worker(new URL('./save-import-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<SaveWorkerResult>) => finish(event.data);
        worker.onerror = () => finish({ error: 'read' });
        worker.onmessageerror = () => finish({ error: 'read' });
        worker.postMessage(input, 'bytes' in input ? [input.bytes] : []);
    };
    void (async () => {
        validateSaveFile(request.file);
        const context = { dataVersion: request.dataVersion, buildings: request.buildings, items: request.items };
        // File/Blob cloning shares immutable backing data; the worker reads it in chunks.
        // Structural sources used by headless/test adapters retain their byte-based path.
        if (request.file instanceof Blob) start({ file: request.file, context });
        else start({ bytes: await readSaveFile(request.file, signal), context });
    })().catch(error => finish({ error: error instanceof SaveImportError ? error.code : 'read' }));
});
