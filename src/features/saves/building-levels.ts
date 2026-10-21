import type { BuildingStack } from './building-stacks';
import type { SaveBuilding } from './snapshot';

/** Stack depth: unrelated buildings stay at level 1 regardless of terrain height. */
export function buildBuildingLevels(buildings: readonly Pick<SaveBuilding, 'id' | 'position'>[], stacks: ReadonlyMap<number, BuildingStack>) {
    const byBuilding = new Map<number, number>();
    // Every below edge points to a smaller Z, so this is a topological traversal.
    // A bridge over several stacks sits one level above the deepest lower stack.
    for (const building of [...buildings].sort((a, b) => a.position.z - b.position.z || a.id - b.id)) {
        let level = 1;
        for (const id of stacks.get(building.id)?.below ?? []) {
            const lowerLevel = byBuilding.get(id);
            if (lowerLevel !== undefined) level = Math.max(level, lowerLevel + 1);
        }
        byBuilding.set(building.id, level);
    }
    return byBuilding;
}
