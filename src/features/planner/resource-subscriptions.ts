import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { buildCoreCoverage } from '@/features/saves/coverage';
import { buildCoreResourcePicker } from './core-resources';
import { aggregatePlannerResources, buildPlannerResourceSummary, getPlannerResourceFit } from './resources';
import { compareProductionBuildings, getPlannerStatsBuildingRows } from './building-stats';

export const registerPlannerResourceSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regRootSub(appIds.subscriptions.PLANNER_COMPARISON_CORE_IDS, stateKeys.plannerComparisonCoreIds);
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
            return buildCoreResourcePicker(overview, workspace.snapshot.gameData.version === version && workspace.snapshot.gameData.revision === metadata?.revision);
        });
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_PICKER,
        id => [[appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE, id], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]],
        ([picker, targets]) => !picker ? null : { ...picker, groups: picker.groups.map(core => ({ ...core, buildings: core.buildings.map(building => ({ ...building,
            isTarget: targets.includes(building.itemId),
        })) })) });
    registrar.regSub(appIds.subscriptions.PLANNER_RESOURCE_FIT,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB], [appIds.subscriptions.BUILDINGS_LIST]],
        ([tab, buildings]) => getPlannerResourceFit(tab, buildings));
    registrar.regSub(appIds.subscriptions.PLANNER_BUILDING_COMPARISON,
        () => [[appIds.subscriptions.PLANNER_COMPARISON_CORE_IDS], [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE],
            [appIds.subscriptions.APP_DATA_VERSION], [appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.BUILDINGS_LIST], [appIds.subscriptions.SAVES_BUILDING_CATALOG]],
        ([coreIds, workspace, version, flow, buildings, metadata]) => {
            if (!coreIds.length || !workspace || workspace.snapshot.gameData.version !== version || workspace.snapshot.gameData.revision !== metadata?.revision) return { coreNames: [], rows: [] };
            const ordered = [...workspace.snapshot.cores].sort((a, b) => a.spawnTimeSeconds - b.spawnTimeSeconds || a.id - b.id);
            const cores = ordered.filter(core => coreIds.includes(core.id));
            if (cores.length !== coreIds.length) return { coreNames: [], rows: [] };
            const { buildingsByCore } = buildCoreCoverage(ordered);
            const coreNames = cores.map(core => core.name?.trim() || `Core ${ordered.indexOf(core) + 1}`);
            const covered = cores.flatMap(core => buildingsByCore.get(core.id)!);
            return { coreNames, rows: compareProductionBuildings(flow.nodes, covered, buildings, metadata) };
        });
    registrar.regSub(appIds.subscriptions.PLANNER_STATS_BUILDING_ROWS,
        () => [[appIds.subscriptions.PLANNER_STATS_DETAILED], [appIds.subscriptions.PLANNER_BUILDING_COMPARISON]],
        ([stats, comparison]) => getPlannerStatsBuildingRows(stats.buildingStats, comparison.rows));
};
