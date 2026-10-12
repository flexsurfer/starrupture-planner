import { decodeSave, SaveImportError } from '@/features/saves/decoder/decode';
import type { SaveDataContext } from '@/features/saves/decoder/types';
import type { SaveImportErrorCode } from '@/features/saves/import-error';
import type { SaveSnapshot } from '@/features/saves/snapshot';
import { loadWebSaveContext } from './game-data-loader';

export type SaveWorkerResult = { report: SaveSnapshot } | { error: SaveImportErrorCode };

self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; context: SaveDataContext }>) => {
    let result: SaveWorkerResult;
    try {
        const context = await loadWebSaveContext(event.data.context);
        result = { report: await decodeSave(event.data.bytes, context) };
    }
    catch (error) { result = { error: error instanceof SaveImportError ? error.code : 'read' }; }
    self.postMessage(result);
};
