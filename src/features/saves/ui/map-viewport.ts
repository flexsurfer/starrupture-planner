import type { SaveMapEntity } from '../map';
import { coreMarkerSize, projectMapPosition } from '../map-coordinates';

// Keep building badges, level navigation and automatic Core focus at one detail threshold.
export const BUILDING_DETAIL_ZOOM = 0.45;

interface FocusMarker { coreId: number; x: number; y: number; isCore: boolean }

export function mapFocusMarkers(entities: readonly SaveMapEntity[]): FocusMarker[] {
    return entities.map(entity => ({ coreId: entity.core.core.id, ...projectMapPosition(entity.position), isCore: entity.detail === null }));
}

/** Focus the nearest visible marker, never the empty space between a Core's buildings. */
export function coreInViewport(markers: readonly FocusMarker[], viewport: { x: number; y: number; zoom: number }, width: number, height: number, buildingSize: number): number | null {
    if (viewport.zoom < BUILDING_DETAIL_ZOOM || width <= 0 || height <= 0) return null;
    const left = -viewport.x / viewport.zoom, top = -viewport.y / viewport.zoom;
    const right = left + width / viewport.zoom, bottom = top + height / viewport.zoom;
    const x = (left + right) / 2, y = (top + bottom) / 2;
    const coreHalfSize = coreMarkerSize(viewport.zoom) / 2;
    let closest: { id: number; distance: number } | null = null;
    for (const marker of markers) {
        const halfSize = marker.isCore ? coreHalfSize : buildingSize / 2;
        if (marker.x + halfSize <= left || marker.x - halfSize >= right
            || marker.y + halfSize <= top || marker.y - halfSize >= bottom) continue;
        const distance = (marker.x - x) ** 2 + (marker.y - y) ** 2;
        if (!closest || distance < closest.distance || (distance === closest.distance && marker.coreId < closest.id)) {
            closest = { id: marker.coreId, distance };
        }
    }
    return closest?.id ?? null;
}
