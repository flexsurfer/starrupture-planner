import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { createSaveGameData } from './game-data';
import { buildSaveOverview } from './overview';
import { buildSaveMap } from './map';
import { workspaceIds } from './workspace';

export const registerSavesSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regRootSub(appIds.subscriptions.SAVES_BUILDING_CATALOG, stateKeys.savesBuildingCatalog);
    registrar.regSub(appIds.subscriptions.SAVES_GAME_DATA,
        () => [[appIds.subscriptions.BUILDINGS_LIST], [appIds.subscriptions.ITEMS_LIST], [appIds.subscriptions.SAVES_BUILDING_CATALOG]],
        ([buildings, items, metadata]) => createSaveGameData(buildings, items, metadata));
    registrar.regRootSub(appIds.subscriptions.SAVES_IMPORT, stateKeys.savesImport);
    registrar.regRootSub(appIds.subscriptions.SAVES_WORKSPACES, stateKeys.savesWorkspaces);
    registrar.regRootSub(appIds.subscriptions.SAVES_WORKSPACE_ORDER, stateKeys.savesWorkspaceOrder);
    registrar.regRootSub(appIds.subscriptions.SAVES_ACTIVE_WORKSPACE_ID, stateKeys.savesActiveWorkspaceId);
    registrar.regRootSub(appIds.subscriptions.SAVES_SELECTIONS, stateKeys.savesSelections);
    registrar.regRootSub(appIds.subscriptions.SAVES_SELECTED_VIEW, stateKeys.savesSelectedView);
    registrar.regRootSub(appIds.subscriptions.SAVES_MAP_SELECTED_NODES, stateKeys.savesMapSelectedNodes);
    registrar.regRootSub(appIds.subscriptions.SAVES_MAP_DISPLAY, stateKeys.savesMapDisplay);
    registrar.regRootSub(appIds.subscriptions.SAVES_MAP_LAYERS, stateKeys.savesMapLayers);
    registrar.regRootSub(appIds.subscriptions.SAVES_MAP_VIEWPORTS, stateKeys.savesMapViewports);
    registrar.regSub(appIds.subscriptions.SAVES_MAP_VIEWPORT,
        () => [[appIds.subscriptions.SAVES_MAP_VIEWPORTS]],
        ([viewports], id) => viewports[id] ?? null);
    registrar.regRootSub(appIds.subscriptions.SAVES_STORAGE_ERROR, stateKeys.savesStorageError);
    registrar.regSub(appIds.subscriptions.SAVES_TABS,
        () => [[appIds.subscriptions.SAVES_WORKSPACES], [appIds.subscriptions.SAVES_WORKSPACE_ORDER]],
        ([workspaces, order]) => workspaceIds(workspaces, order).map(id => ({ id, name: workspaces[id].name })));
    registrar.regSub(appIds.subscriptions.SAVES_WORKSPACE_BY_ID,
        () => [[appIds.subscriptions.SAVES_WORKSPACES]],
        ([workspaces], id) => Object.hasOwn(workspaces, id) ? workspaces[id] : null);
    registrar.regSub(appIds.subscriptions.SAVES_ACTIVE_WORKSPACE,
        () => [[appIds.subscriptions.SAVES_WORKSPACES], [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE_ID], [appIds.subscriptions.SAVES_WORKSPACE_ORDER]],
        ([workspaces, id, order]) => (id && Object.hasOwn(workspaces, id) ? workspaces[id] : workspaces[workspaceIds(workspaces, order)[0]]) ?? null);
    registrar.regSub(appIds.subscriptions.SAVES_OVERVIEW,
        id => [[appIds.subscriptions.SAVES_WORKSPACE_BY_ID, id], [appIds.subscriptions.SAVES_GAME_DATA]],
        ([workspace, data]) => workspace ? buildSaveOverview(workspace, data) : null);
    registrar.regSub(appIds.subscriptions.SAVES_MAP,
        id => [[appIds.subscriptions.SAVES_OVERVIEW, id], [appIds.subscriptions.SAVES_GAME_DATA]],
        ([overview, data]) => overview ? buildSaveMap(overview, data) : null);
    registrar.regSub(appIds.subscriptions.SAVES_CORE_BY_ID,
        id => [[appIds.subscriptions.SAVES_OVERVIEW, id]],
        ([overview], _id, coreId) => overview?.cores.find(coreOverview => coreOverview.core.id === coreId) ?? null);
    registrar.regSub(appIds.subscriptions.SAVES_SELECTED_CORE,
        id => [[appIds.subscriptions.SAVES_OVERVIEW, id], [appIds.subscriptions.SAVES_SELECTIONS]],
        ([overview, selections], id) => overview?.cores.find(coreOverview => coreOverview.core.id === selections[id]?.coreId) ?? null);
};
