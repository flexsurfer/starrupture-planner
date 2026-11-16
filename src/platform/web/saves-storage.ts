import type { SyncPersistStorage } from '@ukladjs/persist';
import { deserializeSaveWorkspaces, normalizeSavesOrder, normalizeSavesActiveId, normalizeSavesSelections } from '@/features/saves/storage-schema';
import { stateKeys } from '@/app/uklad/catalog';
import { PERSIST_KEYS } from './persistence';

const validators: Record<string, (value: unknown) => unknown> = {
    [stateKeys.savesWorkspaces]: deserializeSaveWorkspaces,
    [stateKeys.savesWorkspaceOrder]: normalizeSavesOrder,
    [stateKeys.savesActiveWorkspaceId]: normalizeSavesActiveId,
    [stateKeys.savesSelections]: normalizeSavesSelections,
};

/** A fresh namespace deliberately leaves experimental schemas behind, without migrating them. */
export const savesStorageKey = (prefix: string, root: string) => `${prefix}/saves-v1/${encodeURIComponent(root)}`;

/**
 * Invalid Saves data must not stop persistence of unrelated app roots. Preserve bad entries for recovery.
 * Use the returned storage and keys together for one Persist attachment.
 */
export function createSavesStorage(storage: SyncPersistStorage, prefix: string) {
    let loadFailed = false;
    let validatedWorkspaces: ReturnType<typeof deserializeSaveWorkspaces> | undefined;
    const roots = new Map(Object.keys(validators).map(root => [`${prefix}/${encodeURIComponent(root)}`, root]));
    const adapter: SyncPersistStorage = {
        sync: true,
        getItem(key) {
            const root = roots.get(key);
            if (!root) return storage.getItem(key);
            if (loadFailed) return null;
            try {
                if (root === stateKeys.savesWorkspaces) validatedWorkspaces = undefined;
                const raw = storage.getItem(savesStorageKey(prefix, root));
                if (raw === null) return null;
                const envelope = JSON.parse(raw) as { v?: unknown; data?: unknown } | null;
                if (!envelope || envelope.v !== 1) throw new Error('Invalid Saves envelope');
                if (root === stateKeys.savesWorkspaces) {
                    validatedWorkspaces = deserializeSaveWorkspaces(envelope.data);
                    // Persist receives a small handoff envelope; the validated collection stays attachment-local.
                    return '{"v":1,"data":null}';
                }
                validators[root](envelope.data);
                return raw;
            } catch { loadFailed = true; return null; }
        },
        setItem(key, value) {
            const root = roots.get(key);
            if (root === stateKeys.savesWorkspaces) validatedWorkspaces = undefined;
            if (root && loadFailed) return;
            storage.setItem(root ? savesStorageKey(prefix, root) : key, value);
        },
        removeItem(key) {
            const root = roots.get(key);
            if (root === stateKeys.savesWorkspaces) validatedWorkspaces = undefined;
            storage.removeItem(root ? savesStorageKey(prefix, root) : key);
        },
    };
    const keys = PERSIST_KEYS.map(config => typeof config === 'string' || config.key !== stateKeys.savesWorkspaces ? config : {
        ...config,
        deserialize(value: unknown) {
            if (value !== null || validatedWorkspaces === undefined) throw new Error('Missing validated Saves collection');
            const workspaces = validatedWorkspaces;
            validatedWorkspaces = undefined; // Transfer ownership once, without retaining runtime data.
            return workspaces;
        },
    });
    return { storage: adapter, keys, hasLoadError: () => loadFailed };
}
