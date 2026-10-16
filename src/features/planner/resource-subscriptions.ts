import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { coreKey } from '@/features/saves/snapshot';
import { aggregatePlannerResources, buildPlannerResourceSummary, getPlannerResourceFit, saveResourceSnapshotKey } from './resources';
import type { PlannerStatsBuildingRow } from './types';

export const registerPlannerResourceSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCES,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.resources ?? []);
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_ITEMS,
        () => [[appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS], [appIds.subscriptions.ITEMS_LIST]],
        ([flow, targets, items]) => {
            const planItems = new Set(flow.nodes.map(node => node.outputItem));
            for (const target of targets) planItems.delete(target);
            return items.filter(item => planItems.has(item.id));
        });
    registrar.regSub(appIds.subscriptions.PLANNER_EXTERNAL_INPUTS,
        () => [[appIds.subscriptions.PLANNER_RESOURCES], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]],
        ([resources, targets]) => aggregatePlannerResources(resources, targets));
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_SUMMARY,
        () => [[appIds.subscriptions.PLANNER_RESOURCES], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS], [appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.ITEMS_LIST]],
        ([resources, targets, flow, items]) => buildPlannerResourceSummary(resources, targets, flow, items));
    registrar.regSub(appIds.subscriptions.PLANNER_FILTERED_RESOURCE_SUMMARY,
        () => [[appIds.subscriptions.PLANNER_RESOURCE_SUMMARY]],
        ([groups], itemId) => itemId === null ? groups : groups.filter(group => group.itemId === itemId));
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE,
        id => [[appIds.subscriptions.SAVES_OVERVIEW, id], [appIds.subscriptions.APP_DATA_VERSION], [appIds.subscriptions.SAVES_BUILDING_CATALOG]],
        ([overview, version, metadata]) => {
            if (!overview) return null;
            const { workspace } = overview;
            return { workspaceId: workspace.id, snapshotKey: saveResourceSnapshotKey(workspace.snapshot),
                compatible: workspace.snapshot.gameData.version === version && workspace.snapshot.gameData.revision === metadata?.revision,
                cores: overview.cores.map((core, index) => ({ coreId: core.core.id, coreKey: coreKey(core.core), name: core.core.name?.trim() || `Core ${index + 1}`,
                    buildings: core.incoming.flatMap(resource => resource.buildings.map(building => ({ buildingId: building.buildingId, buildingTypeId: building.buildingTypeId,
                        buildingName: building.name.trim() || core.buildingDetails.find(detail => detail.instance.id === building.buildingId)?.building.name || building.buildingTypeId, itemId: resource.itemId, itemName: resource.name, capacity: building.rate,
                        source: resource.source === 'extraction' ? 'extraction' as const : 'delivery' as const, isTarget: false, alreadyAdded: false }))) })) };
        });
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_PICKER,
        id => [[appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE, id], [appIds.subscriptions.PLANNER_RESOURCES], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]],
        ([picker, resources, targets]) => !picker ? null : { ...picker, cores: picker.cores.map(core => ({ ...core, buildings: core.buildings.map(building => ({ ...building,
            isTarget: targets.includes(building.itemId), alreadyAdded: resources.some(row => row.origin?.workspaceId === picker.workspaceId
                && row.origin.coreKey === core.coreKey && row.origin.buildingId === building.buildingId && row.itemId === building.itemId),
        })) })) });
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_FIT,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB], [appIds.subscriptions.BUILDINGS_LIST]],
        ([tab, buildings]) => getPlannerResourceFit(tab, buildings));
    registrar.regSub(appIds.subscriptions.PLANNER_BUILDING_COMPARISON,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB], [appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.BUILDINGS_LIST], [appIds.subscriptions.SAVES_BUILDING_CATALOG]],
        ([tab, flow, buildings, metadata]) => {
            const baseline = tab?.buildingBaseline ?? null;
            if (!baseline) return { baseline, rows: [] };
            const names = new Map(buildings.map(building => [building.id, building.name]));
            const productionIds = new Set(buildings.filter(building => metadata?.kinds[building.id]
                ? metadata.kinds[building.id] === 'production' : building.recipes?.some(recipe => recipe.inputs.length > 0)).map(building => building.id));
            const required = new Map<string, number>();
            for (const node of flow.nodes) if (node.nodeType === 'production' && productionIds.has(node.buildingId)) required.set(node.buildingId, (required.get(node.buildingId) ?? 0) + Math.ceil(node.buildingCount));
            const ids = [...new Set([...Object.keys(baseline.counts), ...required.keys()])];
            return { baseline, rows: ids.map(buildingTypeId => {
                const existing = baseline.counts[buildingTypeId] ?? 0;
                const planned = required.get(buildingTypeId) ?? 0;
                return { buildingTypeId, name: names.get(buildingTypeId) ?? buildingTypeId, existing, planned,
                    additional: Math.max(0, planned - existing), spare: Math.max(0, existing - planned) };
            }).sort((a, b) => a.name.localeCompare(b.name)) };
        });
    registrar.regSub(appIds.subscriptions.PLANNER_STATS_BUILDING_ROWS,
        () => [[appIds.subscriptions.PLANNER_STATS_DETAILED], [appIds.subscriptions.PLANNER_BUILDING_COMPARISON]],
        ([stats, comparison]) => {
            const rows = new Map<string, PlannerStatsBuildingRow>(stats.buildingStats.map(building => [building.buildingId, { ...building, comparison: null }]));
            for (const row of comparison.rows) {
                const building = rows.get(row.buildingTypeId) ?? {
                    buildingId: row.buildingTypeId, buildingName: row.name, count: 0, totalPower: 0, totalHeat: 0,
                };
                rows.set(row.buildingTypeId, { ...building, comparison: { existing: row.existing, additional: row.additional } });
            }
            return [...rows.values()];
        });
};
