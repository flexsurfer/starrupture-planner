import type { UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { appIds } from '@/app/uklad/catalog';
import { SaveImportError } from '@/features/saves/import-error';
import { validateSaveFile } from '@/features/saves/reader';
import type { SaveSnapshot } from '@/features/saves/snapshot';
import type { SaveImportRequest } from '@/features/saves/types';

export type SaveImportDecoder = (request: SaveImportRequest, signal: AbortSignal) => Promise<SaveSnapshot>;

/** Each platform owns one cancellable reader per runtime. */
export function registerSaveImportEffects(registrar: UkladRegistrar<AppContracts>, decode: SaveImportDecoder) {
    let controller: AbortController | null = null;
    const cancel = () => { controller?.abort(); controller = null; };
    registrar.regEffect(appIds.effects.savesCancelImport, cancel);
    registrar.regEffect(appIds.effects.savesReadImport, (request, runtime) => {
        cancel();
        const active = new AbortController();
        controller = active;
        void (async () => {
            try {
                validateSaveFile(request.file);
                const report = await decode(request, active.signal);
                if (!active.signal.aborted) runtime.dispatch([appIds.events.SAVES_IMPORT_READY, request.requestId, report]);
            } catch (error) {
                if (!active.signal.aborted) runtime.dispatch([appIds.events.SAVES_IMPORT_FAILED, request.requestId,
                    error instanceof SaveImportError ? error.code : 'read']);
            } finally {
                if (controller === active) controller = null;
            }
        })();
    });
    return cancel;
}
