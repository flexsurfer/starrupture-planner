import type { SavePosition } from './snapshot';

export const SAVE_UNITS_PER_MAP_UNIT = 10;
export const CORE_MARKER_SIZE = 32;

/** Keep Cores compact but recognizable: 24–32 screen pixels across the zoom range. */
export const coreMarkerSize = (zoom: number) => Math.min(CORE_MARKER_SIZE / zoom, Math.max(CORE_MARKER_SIZE, 24 / zoom));

/** Shared by node rendering and overlap detection, before viewport zoom or pan. */
export const projectMapPosition = (position: Pick<SavePosition, 'x' | 'y'>) => ({
    x: position.x / SAVE_UNITS_PER_MAP_UNIT, y: position.y / SAVE_UNITS_PER_MAP_UNIT,
});
