import type { BaseLayoutBuilding } from "@/app/uklad/model";

export const GRID_CELL_SIZE = 100; // Size of each grid cell in pixels
export const EXPAND_THRESHOLD = 3; // Expand grid when building is within N cells of edge

export interface GridPosition {
  x: number;
  y: number;
}

export interface GridBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Checks if a grid position is occupied by any building
 */
export function isGridPositionOccupied(
  x: number,
  y: number,
  buildings: BaseLayoutBuilding[],
): boolean {
  return buildings.some((b) => b.x === x && b.y === y);
}

/**
 * Finds the nearest valid (unoccupied) position on the grid
 * Uses spiral search pattern from the target position
 */
export function getValidPlacementPosition(
  targetX: number,
  targetY: number,
  buildings: BaseLayoutBuilding[],
): GridPosition {
  // Check if target position is valid
  if (!isGridPositionOccupied(targetX, targetY, buildings)) {
    return { x: targetX, y: targetY };
  }

  // Spiral search outward
  let radius = 1;
  const maxRadius = 20; // Prevent infinite loops

  while (radius <= maxRadius) {
    // Check positions in a square ring at this radius
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Only check positions on the outer ring
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          const x = targetX + dx;
          const y = targetY + dy;

          if (!isGridPositionOccupied(x, y, buildings)) {
            return { x, y };
          }
        }
      }
    }
    radius++;
  }

  // Fallback: return target position (let user handle the conflict)
  return { x: targetX, y: targetY };
}

/**
 * Calculates the bounding box of all buildings on the layout
 */
export function calculateGridBounds(
  buildings: BaseLayoutBuilding[],
): GridBounds {
  if (buildings.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = buildings[0].x;
  let maxX = buildings[0].x;
  let minY = buildings[0].y;
  let maxY = buildings[0].y;

  for (const building of buildings) {
    minX = Math.min(minX, building.x);
    maxX = Math.max(maxX, building.x);
    minY = Math.min(minY, building.y);
    maxY = Math.max(maxY, building.y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Checks if a building is near the edge of the canvas and should trigger expansion
 */
export function shouldExpandGrid(
  building: BaseLayoutBuilding,
  currentBounds: GridBounds,
): boolean {
  const distToMinX = building.x - currentBounds.minX;
  const distToMaxX = currentBounds.maxX - building.x;
  const distToMinY = building.y - currentBounds.minY;
  const distToMaxY = currentBounds.maxY - building.y;

  return (
    distToMinX < EXPAND_THRESHOLD ||
    distToMaxX < EXPAND_THRESHOLD ||
    distToMinY < EXPAND_THRESHOLD ||
    distToMaxY < EXPAND_THRESHOLD
  );
}

/**
 * Snaps a pixel coordinate to the nearest grid coordinate
 */
export function snapToGrid(pixelX: number, pixelY: number): GridPosition {
  return {
    x: Math.round(pixelX / GRID_CELL_SIZE),
    y: Math.round(pixelY / GRID_CELL_SIZE),
  };
}

/**
 * Converts grid coordinates to pixel coordinates (center of cell)
 */
export function gridToPixels(gridX: number, gridY: number): GridPosition {
  return {
    x: gridX * GRID_CELL_SIZE,
    y: gridY * GRID_CELL_SIZE,
  };
}

/**
 * Generates a unique ID for a layout building
 */
export function generateLayoutBuildingId(): string {
  return `layout_building_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generates a unique ID for a layout connection
 */
export function generateLayoutConnectionId(): string {
  return `layout_connection_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
