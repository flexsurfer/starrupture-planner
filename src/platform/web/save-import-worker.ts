import { decodeSave } from '@/features/saves/decoder/decode';
import type { SaveDataContext } from '@/features/saves/decoder/types';
import { saveImportFailure, type SaveImportFailure } from '@/features/saves/import-error';
import type { SaveSnapshot } from '@/features/saves/snapshot';
import { loadWebSaveContext } from './game-data-loader';

export type SaveWorkerResult = { report: SaveSnapshot } | SaveImportFailure;
export type SaveWorkerInput = { context: SaveDataContext } & ({ file: Blob } | { bytes: ArrayBuffer });

self.onmessage = async (event: MessageEvent<SaveWorkerInput>) => {
    let result: SaveWorkerResult;
    try {
        const context = await loadWebSaveContext(event.data.context);
        result = { report: await decodeSave('file' in event.data ? event.data.file : event.data.bytes, context) };
    }
    catch (error) { result = saveImportFailure(error); }
    self.postMessage(result);
};
