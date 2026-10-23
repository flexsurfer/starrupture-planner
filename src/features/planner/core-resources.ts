import type { SaveOverview } from '@/features/saves/overview';
import { coreKey } from '@/features/saves/snapshot';
import { groupPlannerCoreAllocations, importedPlannerBuildingIds, isValidResourceRate, saveResourceSnapshotKey,
    type PlannerCoreAllocation, type PlannerResource, type PlannerResourcePicker, type PlannerResourceSelection } from './resources';

/** One resource source in one section, named for its complete Core coverage. */
export function buildCoreResourcePicker(overview: SaveOverview, compatible: boolean): PlannerResourcePicker {
    const groups = new Map<string, PlannerResourcePicker['groups'][number]>();
    const seen = new Set<number>();
    const cores = new Map(overview.cores.map(core => [core.core.id, core.core]));
    for (const core of overview.cores) for (const resource of core.incoming) for (const building of resource.buildings) {
        if (seen.has(building.buildingId)) continue;
        seen.add(building.buildingId);
        const ids = building.cores.map(core => core.id);
        const key = ids.map(id => coreKey(cores.get(id)!)).join('|');
        const group = groups.get(key) ?? { coreId: ids[0], coreIds: ids, coreKey: key,
            name: building.cores.map(core => core.name?.trim() || `Core ${core.number}`).join(', '), buildings: [] };
        group.buildings.push({ buildingId: building.buildingId, buildingTypeId: building.buildingTypeId,
            buildingName: building.name.trim() || building.buildingTypeId, itemId: resource.itemId, itemName: resource.name, capacity: building.rate,
            source: resource.source === 'extraction' ? 'extraction' : 'delivery', isTarget: false });
        groups.set(key, group);
    }
    return { workspaceId: overview.workspace.id, snapshotKey: saveResourceSnapshotKey(overview.workspace.snapshot), compatible,
        cores: overview.cores.map((core, index) => ({ coreId: core.core.id, coreKey: coreKey(core.core), name: core.core.name?.trim() || `Core ${index + 1}` })),
        groups: [...groups.values()].sort((a, b) => Number(b.coreIds.length > 1) - Number(a.coreIds.length > 1)) };
}

/** Validate first, then count each physical source at most once in this snapshot. */
export function prepareCoreResourceSelection(picker: PlannerResourcePicker, selections: PlannerResourceSelection[], resources: PlannerResource[] = []) {
    const available = new Map(picker.groups.flatMap(core => core.buildings.map(building => [building.buildingId, { core, building }] as const)));
    const selected = new Map<number, { core: PlannerResourcePicker['groups'][number]; building: PlannerResourcePicker['groups'][number]['buildings'][number]; rate: number }>();
    for (const selection of selections) {
        if (!selection || !Number.isSafeInteger(selection.buildingId)) return null;
        const entry = available.get(selection.buildingId);
        if (!entry || entry.building.isTarget) return null;
        if (selected.has(selection.buildingId)) continue;
        const rate = selection.ratePerMinute ?? entry.building.capacity;
        if (!isValidResourceRate(rate)) return null;
        selected.set(selection.buildingId, { ...entry, rate });
    }
    const imported = importedPlannerBuildingIds(resources, picker);
    const allocations: PlannerCoreAllocation[] = [];
    for (const [id, { core, building, rate }] of selected) {
        if (imported.has(id)) continue;
        allocations.push({ coreId: core.coreId, coreName: core.name, ...(core.coreIds.length > 1 ? { coreIds: core.coreIds } : {}),
            itemId: building.itemId, ratePerMinute: rate,
            source: { workspaceId: picker.workspaceId, snapshotKey: picker.snapshotKey, buildingIds: [id] } });
    }
    const grouped = groupPlannerCoreAllocations(allocations);
    return grouped.every(row => isValidResourceRate(row.ratePerMinute)) ? grouped : null;
}
