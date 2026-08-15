import { appIds } from '../app/uklad/catalog';

/**
 * Transitional name-only export for untouched UI call sites.
 * New code imports `appIds.subscriptions` directly from the application catalog.
 */
export const SUB_IDS = appIds.subscriptions;
