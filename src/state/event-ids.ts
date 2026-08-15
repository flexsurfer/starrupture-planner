import { appIds } from '../app/uklad/catalog';

/**
 * Transitional name-only export for untouched UI call sites.
 * New code imports `appIds.events` directly from the application catalog.
 */
export const EVENT_IDS = appIds.events;
