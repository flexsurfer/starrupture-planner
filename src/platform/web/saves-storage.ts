import type { SyncPersistStorage } from '@ukladjs/persist';
import { normalizeSaveWorkspaces, normalizeSavesOrder, normalizeSavesActiveId, normalizeSavesSelections } from '@/features/saves/storage-schema';
import { stateKeys } from '@/app/uklad/catalog';

const validators: Record<string, (value: unknown) => unknown> = {
    [stateKeys.savesWorkspaces]: normalizeSaveWorkspaces,
    [stateKeys.savesWorkspaceOrder]: normalizeSavesOrder,
    [stateKeys.savesActiveWorkspaceId]: normalizeSavesActiveId,
    [stateKeys.savesSelections]: normalizeSavesSelections,
};

/** A fresh namespace deliberately leaves experimental schemas behind, without migrating them. */
export const savesStorageKey = (prefix: string, root: string) => `${prefix}/saves-v1/${encodeURIComponent(root)}`;

/** Invalid Saves data must not stop persistence of unrelated app roots. Preserve bad entries for recovery. */
export function createSavesStorage(storage: SyncPersistStorage, prefix: string) {
    let loadFailed = false;
    const roots = new Map(Object.keys(validators).map(root => [`${prefix}/${encodeURIComponent(root)}`, root]));
    const adapter: SyncPersistStorage = {
        sync: true,
        getItem(key) {
            const root = roots.get(key);
            if (!root) return storage.getItem(key);
            if (loadFailed) return null;
            try {
                const raw = storage.getItem(savesStorageKey(prefix, root));
                if (raw === null) return null;
                const envelope = JSON.parse(raw) as { v?: unknown; data?: unknown } | null;
                if (!envelope || envelope.v !== 1) throw new Error('Invalid Saves envelope');
                validators[root](envelope.data);
                return raw;
            } catch { loadFailed = true; return null; }
        },
        setItem(key, value) {
            const root = roots.get(key);
            if (root && loadFailed) return;
            storage.setItem(root ? savesStorageKey(prefix, root) : key, value);
        },
        removeItem(key) {
            const root = roots.get(key);
            storage.removeItem(root ? savesStorageKey(prefix, root) : key);
        },
    };
    return { storage: adapter, hasLoadError: () => loadFailed };
}
