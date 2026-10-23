import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { createSaveGameData } from '@/features/saves/game-data';
import { buildSaveOverview } from '@/features/saves/overview';
import { getActiveSaveWorkspace } from '@/features/saves/workspace';
import { getActivePlannerTab } from './state';
import { buildCoreResourcePicker, prepareCoreResourceSelection } from './core-resources';
import { getPlannerResourceFit, hasPlannerCoreAllocation, isValidResourceRate, nextPlannerResourceId, plannerTargetIds, saveResourceSnapshotKey, type PlannerResource } from './resources';

export const registerPlannerResourceEvents: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regEvent(appIds.events.PLANNER_ADD_MANUAL_RESOURCE, ({ draftState }, itemId, ratePerMinute) => {
        const tab = getActivePlannerTab(draftState);
        if (!tab || tab.resources.length >= 10000 || !isValidResourceRate(ratePerMinute) || !draftState.itemsList.some(item => item.id === itemId)
            || plannerTargetIds(tab).includes(itemId)) return;
        tab.resources.push({ id: nextPlannerResourceId(tab.resources), itemId, ratePerMinute, enabled: true });
    });
    registrar.regEvent(appIds.events.PLANNER_SET_RESOURCE_RATE, ({ draftState }, id, ratePerMinute) => {
        const row = getActivePlannerTab(draftState)?.resources.find(resource => resource.id === id);
        if (row && isValidResourceRate(ratePerMinute)) row.ratePerMinute = ratePerMinute;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_RESOURCE_ENABLED, ({ draftState }, id, enabled) => {
        const row = getActivePlannerTab(draftState)?.resources.find(resource => resource.id === id);
        if (row && typeof enabled === 'boolean') row.enabled = enabled;
    });
    registrar.regEvent(appIds.events.PLANNER_REMOVE_RESOURCE, ({ draftState }, id) => {
        const tab = getActivePlannerTab(draftState);
        if (!tab) return;
        const index = tab.resources.findIndex(resource => resource.id === id);
        if (index < 0) return;
        tab.resources.splice(index, 1);
    });
    registrar.regEvent(appIds.events.PLANNER_IMPORT_CORE_RESOURCES, ({ draftState }, workspaceId, snapshotKey, selections) => {
        const tab = getActivePlannerTab(draftState);
        const workspace = draftState.savesWorkspaces[workspaceId];
        const metadata = draftState.savesBuildingCatalog;
        if (!tab || !workspace || workspaceId !== getActiveSaveWorkspace(draftState)?.id || !metadata || draftState.uiGameDataLoadPending
            || workspace.snapshot.gameData.version !== draftState.appDataVersion || workspace.snapshot.gameData.revision !== metadata.revision
            || saveResourceSnapshotKey(workspace.snapshot) !== snapshotKey || !Array.isArray(selections) || !selections.length || selections.length > 10000) return;
        const overview = buildSaveOverview(workspace, createSaveGameData(draftState.buildingsList, draftState.itemsList, metadata));
        const picker = buildCoreResourcePicker(overview, true);
        const targets = new Set(plannerTargetIds(tab));
        for (const core of picker.groups) for (const building of core.buildings) building.isTarget = targets.has(building.itemId);
        const prepared = prepareCoreResourceSelection(picker, selections, tab.resources);
        if (!prepared) return;
        const added: PlannerResource[] = [];
        for (const allocation of prepared) {
            if (hasPlannerCoreAllocation(tab.resources, allocation)) continue;
            added.push({ id: nextPlannerResourceId([...tab.resources, ...added]), ...allocation, enabled: true });
        }
        if (added.length && tab.resources.length + added.length <= 10000) tab.resources.push(...added);
    });
    registrar.regEvent(appIds.events.PLANNER_APPLY_RESOURCE_FIT, ({ draftState }) => {
        const tab = getActivePlannerTab(draftState);
        if (!tab) return;
        const fit = getPlannerResourceFit(tab, draftState.buildingsList);
        if (fit.available && fit.targetAmount !== null) tab.targetAmount = fit.targetAmount;
    });
    registrar.regEvent(appIds.events.PLANNER_SET_COMPARISON_CORES, ({ draftState }, workspaceId, snapshotKey, coreIds) => {
        const tab = getActivePlannerTab(draftState);
        const workspace = draftState.savesWorkspaces[workspaceId];
        if (!tab || !workspace || workspaceId !== getActiveSaveWorkspace(draftState)?.id || !draftState.savesBuildingCatalog || draftState.uiGameDataLoadPending
            || workspace.snapshot.gameData.version !== draftState.appDataVersion || workspace.snapshot.gameData.revision !== draftState.savesBuildingCatalog.revision
            || saveResourceSnapshotKey(workspace.snapshot) !== snapshotKey || !Array.isArray(coreIds) || !coreIds.length) return;
        const selected = new Set(coreIds);
        const ordered = [...workspace.snapshot.cores].sort((a, b) => a.spawnTimeSeconds - b.spawnTimeSeconds || a.id - b.id);
        const cores = ordered.filter(core => selected.has(core.id));
        if (cores.length !== selected.size) return;
        draftState.plannerComparisonCoreIds = cores.map(core => core.id);
    });
    registrar.regEvent(appIds.events.PLANNER_CLEAR_BUILDING_COMPARISON, ({ draftState }) => {
        draftState.plannerComparisonCoreIds = [];
    });
};
