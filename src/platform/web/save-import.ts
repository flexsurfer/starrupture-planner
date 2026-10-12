import { readSaveFile } from '@/features/saves/reader';
import { SaveImportError } from '@/features/saves/decoder/decode';
import type { SaveImportDecoder } from '@/platform/shared/save-import-effects';
import type { SaveWorkerResult } from './save-import-worker';

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
    const timer = setTimeout(() => finish({ error: 'timeout' }), 30_000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    void readSaveFile(request.file, signal).then(bytes => {
        if (finished) return;
        worker = new Worker(new URL('./save-import-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<SaveWorkerResult>) => finish(event.data);
        worker.onerror = () => finish({ error: 'read' });
        worker.onmessageerror = () => finish({ error: 'read' });
        const context = { dataVersion: request.dataVersion, buildings: request.buildings, items: request.items };
        worker.postMessage({ bytes, context }, [bytes]);
    }).catch(error => finish({ error: error instanceof SaveImportError ? error.code : 'read' }));
});
