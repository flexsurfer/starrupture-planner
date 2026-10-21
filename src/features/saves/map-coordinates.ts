import type { SavePosition } from './snapshot';

export const SAVE_UNITS_PER_MAP_UNIT = 10;
export const CORE_MARKER_SIZE = 48;

/** Core markers remain at least 36 screen pixels wide at overview zoom. */
export const coreMarkerSize = (zoom: number) => Math.max(CORE_MARKER_SIZE, 36 / zoom);

/** Shared by node rendering and overlap detection, before viewport zoom or pan. */
export const projectMapPosition = (position: Pick<SavePosition, 'x' | 'y'>) => ({
    x: position.x / SAVE_UNITS_PER_MAP_UNIT, y: position.y / SAVE_UNITS_PER_MAP_UNIT,
});
