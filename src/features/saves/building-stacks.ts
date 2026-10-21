import { SAVE_UNITS_PER_MAP_UNIT } from './map-coordinates';
import { defaultMapDisplay } from './map-preferences';
import type { SaveBuilding } from './snapshot';

/** Numerical noise only, in save world units. */
const WORLD_EPSILON = 0.0001;
/** Inset each edge by 10% so slight visual overlaps do not create extra levels. */
const BUILDING_OVERLAP_SCALE = 0.8;

export interface BuildingStack { above: number[]; below: number[] }
type MapBuilding = Pick<SaveBuilding, 'id' | 'position'>;

/** Positive intersection of inset, centred node squares, excluding equal saved Z. */
export function buildingsStack(a: MapBuilding, b: MapBuilding, buildingSize = defaultMapDisplay.buildingSize): boolean {
    if (Math.abs(a.position.z - b.position.z) <= WORLD_EPSILON) return false;
    // All building nodes share a size. Camera transforms scale both distances
    // and squares equally, so neither zoom nor pan is an input to this test.
    const size = buildingSize * BUILDING_OVERLAP_SCALE * SAVE_UNITS_PER_MAP_UNIT;
    return size - Math.abs(a.position.x - b.position.x) > WORLD_EPSILON
        && size - Math.abs(a.position.y - b.position.y) > WORLD_EPSILON;
}

/** Direct above/below relationships; never transitively merge neighbouring stacks. */
export function buildBuildingStacks(buildings: readonly MapBuilding[], buildingSize = defaultMapDisplay.buildingSize): ReadonlyMap<number, BuildingStack> {
    const result = new Map<number, BuildingStack>(buildings.map(b => [b.id, { above: [], below: [] }]));
    // Broad phase in world units. Cell size affects performance only, not results.
    const cellSize = 1000;
    const halfSize = buildingSize * BUILDING_OVERLAP_SCALE * SAVE_UNITS_PER_MAP_UNIT / 2;
    const cells = new Map<string, Map<number, MapBuilding[]>>();
    const large: MapBuilding[] = [];
    const keys = ({ position }: MapBuilding): string[] => {
        const minX = Math.floor((position.x - halfSize) / cellSize);
        const maxX = Math.floor((position.x + halfSize) / cellSize);
        const minY = Math.floor((position.y - halfSize) / cellSize);
        const maxY = Math.floor((position.y + halfSize) / cellSize);
        // Keep extreme/malformed world extents from allocating unbounded grids.
        if ((maxX - minX + 1) * (maxY - minY + 1) > 64
            || ![minX, maxX, minY, maxY].every(Number.isSafeInteger)) return [];
        const result: string[] = [];
        for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) result.push(`${x}:${y}`);
        return result;
    };
    for (const building of buildings) {
        const occupied = keys(building);
        if (!occupied.length) large.push(building);
        for (const key of occupied) {
            let heights = cells.get(key);
            if (!heights) cells.set(key, heights = new Map());
            const peers = heights.get(building.position.z);
            if (peers) peers.push(building);
            else heights.set(building.position.z, [building]);
        }
    }
    for (const building of buildings) {
        const occupied = keys(building);
        const candidates = new Set<MapBuilding>(occupied.length ? large : buildings);
        for (const key of occupied) for (const [z, peers] of cells.get(key) ?? []) {
            if (Math.abs(z - building.position.z) <= WORLD_EPSILON) continue;
            for (const peer of peers) candidates.add(peer);
        }
        for (const peer of candidates) {
            if (peer.id <= building.id || !buildingsStack(building, peer, buildingSize)) continue;
            const [lower, upper] = building.position.z < peer.position.z ? [building, peer] : [peer, building];
            result.get(lower.id)!.above.push(upper.id);
            result.get(upper.id)!.below.push(lower.id);
        }
    }
    const byId = new Map(buildings.map(b => [b.id, b]));
    for (const stack of result.values()) {
        stack.above.sort((a, b) => byId.get(a)!.position.z - byId.get(b)!.position.z || a - b);
        stack.below.sort((a, b) => byId.get(b)!.position.z - byId.get(a)!.position.z || a - b);
    }
    return result;
}
