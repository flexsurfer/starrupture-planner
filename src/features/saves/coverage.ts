import type { SaveCore, SaveBuilding } from './snapshot';

/** Inclusive saved XYZ coverage; missing bounds retain the imported grouping. */
export function buildCoreCoverage(cores: readonly SaveCore[]) {
    const buildings = cores.flatMap(core => core.buildings);
    const buildingsByCore = new Map<number, SaveBuilding[]>();
    const coresByBuilding = new Map(buildings.map(building => [building.id, [] as SaveCore[]]));
    for (const core of cores) {
        const { bounds } = core;
        const covered = bounds ? buildings.filter(({ position }) =>
            position.x >= bounds.min.x && position.x <= bounds.max.x
            && position.y >= bounds.min.y && position.y <= bounds.max.y
            && position.z >= bounds.min.z && position.z <= bounds.max.z) : core.buildings;
        buildingsByCore.set(core.id, covered);
        for (const building of covered) coresByBuilding.get(building.id)!.push(core);
    }
    return { buildings, buildingsByCore, coresByBuilding };
}
