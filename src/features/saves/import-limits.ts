/** Shared input budgets keep file IO and byte decoding independent. */
export const MAX_SAVE_BYTES = 64 * 1024 * 1024;
export const MAX_DECODED_SAVE_BYTES = 1024 * 1024 * 1024;
export const SAVE_IMPORT_TIMEOUT_MS = 120_000;

/** Parser budgets include pending metadata until the imported entity IDs are known. */
export const MAX_SAVE_POWER_NETWORK_RECORDS = 500_000;
export const MAX_SAVE_PROJECTION_CHARS = 64 * 1024 * 1024;
export const MAX_SAVE_ACTIVE_KEY_CHARS = 16 * 1024 * 1024;
