import type { Building } from '@/app/uklad/model';
import type { SaveBuildingCatalog } from '@/features/saves/game-data';
import type { SaveBuilding } from '@/features/saves/snapshot';
import type { PlannerBuildingComparison } from './resources';
import type { PlannerBuildingStats, PlannerFlowNode, PlannerStatsBuildingRow } from './types';

export function getPlannerBuildingStats(nodes: PlannerFlowNode[]): PlannerBuildingStats[] {
    const byType = new Map<string, PlannerBuildingStats>();
    for (const node of nodes) {
        if (node.nodeType === 'target' || node.nodeType === 'input') continue;
        const row = byType.get(node.buildingId) ?? {
            buildingId: node.buildingId, buildingName: node.buildingName, count: 0, totalPower: 0, totalHeat: 0,
        };
        row.count += Math.ceil(node.buildingCount);
        row.totalPower += node.totalPower;
        row.totalHeat += node.totalHeat;
        byType.set(node.buildingId, row);
    }
    return [...byType.values()].sort((a, b) => b.count - a.count);
}

export function compareProductionBuildings(nodes: PlannerFlowNode[], installedBuildings: SaveBuilding[],
    buildings: Building[], metadata: SaveBuildingCatalog | null): PlannerBuildingComparison['rows'] {
    const counts = new Map<string, number>();
    const counted = new Set<number>();
    for (const building of installedBuildings) {
        if (building.configuration.kind !== 'production' || counted.has(building.id)) continue;
        counted.add(building.id);
        counts.set(building.buildingTypeId, (counts.get(building.buildingTypeId) ?? 0) + 1);
    }
    const names = new Map(buildings.map(building => [building.id, building.name]));
    const productionIds = new Set(buildings.filter(building => metadata?.kinds[building.id]
        ? metadata.kinds[building.id] === 'production' : building.recipes?.some(recipe => recipe.inputs.length > 0)).map(building => building.id));
    const required = new Map<string, number>();
    for (const node of nodes) {
        if (node.nodeType !== 'production' || !productionIds.has(node.buildingId)) continue;
        required.set(node.buildingId, (required.get(node.buildingId) ?? 0) + Math.ceil(node.buildingCount));
    }
    const ids = new Set([...counts.keys(), ...required.keys()]);
    return [...ids].map(buildingTypeId => {
        const existing = counts.get(buildingTypeId) ?? 0;
        const planned = required.get(buildingTypeId) ?? 0;
        return { buildingTypeId, name: names.get(buildingTypeId) ?? buildingTypeId, existing, planned,
            additional: Math.max(0, planned - existing), spare: Math.max(0, existing - planned) };
    }).sort((a, b) => a.name.localeCompare(b.name));
}

export function getPlannerStatsBuildingRows(stats: PlannerBuildingStats[], comparison: PlannerBuildingComparison['rows']): PlannerStatsBuildingRow[] {
    const rows = new Map<string, PlannerStatsBuildingRow>(stats.map(building => [building.buildingId, { ...building, comparison: null }]));
    for (const row of comparison) {
        const building = rows.get(row.buildingTypeId) ?? {
            buildingId: row.buildingTypeId, buildingName: row.name, count: 0, totalPower: 0, totalHeat: 0,
        };
        rows.set(row.buildingTypeId, { ...building, comparison: { existing: row.existing, additional: row.additional } });
    }
    return [...rows.values()];
}
