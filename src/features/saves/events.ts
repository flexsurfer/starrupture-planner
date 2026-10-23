import { normalizeMapDisplay, normalizeMapLayers } from './map-preferences';
import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { current } from '@ukladjs/core/vanilla';
import { createSaveGameData } from './game-data';
import { coreKey } from './snapshot';
import { createSaveImportState } from './state';
import { createSaveWorkspace, getActiveSaveWorkspace, workspaceIds } from './workspace';
import { validateSaveSnapshotCatalog, saveCollectionStorageBytes, MAX_SAVE_WORKSPACES, MAX_SAVES_BYTES, SaveWorkspaceLimitError } from './storage-schema';

export const registerSavesEvents: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regEvent(appIds.events.SAVES_IMPORT_OPEN, ({ draftState }, workspaceId) => {
        if (draftState.savesStorageError === 'load') return;
        if (!workspaceId) {
            let index = draftState.savesImport.requestId + 1;
            do { workspaceId = `save-${index++}`; } while (Object.hasOwn(draftState.savesWorkspaces, workspaceId));
        }
        draftState.savesImport = { ...createSaveImportState(draftState.savesImport.requestId + 1),
            targetWorkspaceId: workspaceId ?? null, phase: 'select' };
        return [[appIds.effects.savesCancelImport]];
    });
    registrar.regEvent(appIds.events.SAVES_IMPORT_CLOSE, ({ draftState }) => {
        if (draftState.savesImport.phase === 'closed') return;
        draftState.savesImport = createSaveImportState(draftState.savesImport.requestId + 1);
        return [[appIds.effects.savesCancelImport]];
    });
    registrar.regEvent(appIds.events.SAVES_IMPORT_READ, ({ draftState }, file) => {
        if (draftState.savesStorageError === 'load' || draftState.savesImport.phase === 'closed') return;
        if (draftState.uiGameDataLoadPending) return;
        if (!draftState.savesBuildingCatalog) { draftState.savesImport.error = 'mapping-version'; return; }
        const requestId = draftState.savesImport.requestId + 1;
        const targetWorkspaceId = draftState.savesImport.targetWorkspaceId;
        draftState.savesImport = { requestId, targetWorkspaceId, phase: 'reading', fileName: file.name, error: null };
        return [[appIds.effects.savesReadImport, {
            requestId, targetWorkspaceId, file, dataVersion: draftState.appDataVersion,
            buildings: current(draftState.buildingsList), items: current(draftState.itemsList),
        }]];
    });
    registrar.regEvent(appIds.events.SAVES_IMPORT_READY, ({ draftState }, requestId, snapshot) => {
        const candidate = draftState.savesImport;
        if (candidate.phase !== 'reading' || candidate.requestId !== requestId) return;
        if (draftState.savesStorageError === 'load') {
            draftState.savesImport = createSaveImportState(requestId + 1);
            return;
        }
        const workspaceId = candidate.targetWorkspaceId;
        if (!workspaceId) return;
        const previous = draftState.savesWorkspaces[workspaceId];
        candidate.phase = 'select';
        let workspace;
        try {
            validateSaveSnapshotCatalog(snapshot, draftState.appDataVersion, createSaveGameData(draftState.buildingsList, draftState.itemsList, draftState.savesBuildingCatalog));
            const name = previous?.name ?? (candidate.fileName!.replace(/\.sav$/i, '').trim().slice(0, 120) || 'Save');
            workspace = createSaveWorkspace(workspaceId, name, snapshot);
        } catch (error) { candidate.error = error instanceof SaveWorkspaceLimitError ? 'save-storage-limit' : 'structure'; return; }
        if ((!previous && Object.keys(draftState.savesWorkspaces).length >= MAX_SAVE_WORKSPACES)
            || saveCollectionStorageBytes({ ...draftState.savesWorkspaces, [workspaceId]: workspace }) > MAX_SAVES_BYTES) {
            candidate.error = 'workspace-limit';
            return;
        }
        const selectedId = draftState.savesSelections[workspaceId]?.coreId;
        const selected = previous?.snapshot.cores.find(core => core.id === selectedId);
        const retainedSelection = selected && workspace.snapshot.cores.some(core => coreKey(core) === coreKey(selected)) ? selected.id : null;
        delete draftState.savesMapSelectedNodes[workspaceId];
        delete draftState.savesMapBuildingFilters[workspaceId];
        draftState.savesWorkspaces[workspaceId] = workspace;
        if (!previous) {
            draftState.savesWorkspaceOrder.push(workspaceId);
            draftState.savesSelectedView = 'map';
            delete draftState.savesMapViewports[workspaceId];
        }
        draftState.plannerComparisonCoreIds = [];
        draftState.savesActiveWorkspaceId = workspaceId;
        draftState.savesSelections[workspaceId] = { coreId: retainedSelection };
        draftState.savesImport = createSaveImportState(requestId + 1);
        return [[appIds.effects.savesCancelImport]];
    });
    registrar.regEvent(appIds.events.SAVES_IMPORT_FAILED, ({ draftState }, requestId, error) => {
        if (draftState.savesImport.phase !== 'reading' || draftState.savesImport.requestId !== requestId) return;
        draftState.savesImport.phase = 'select';
        draftState.savesImport.error = error;
    });
    registrar.regEvent(appIds.events.SAVES_SELECT_WORKSPACE, ({ draftState }, id) => {
        if (draftState.savesStorageError !== 'load' && Object.hasOwn(draftState.savesWorkspaces, id) && draftState.savesActiveWorkspaceId !== id) {
            draftState.plannerComparisonCoreIds = [];
            draftState.savesActiveWorkspaceId = id;
        }
    });
    registrar.regEvent(appIds.events.SAVES_RENAME_WORKSPACE, ({ draftState }, id, name) => {
        const workspace = draftState.savesWorkspaces[id];
        if (draftState.savesStorageError === 'load' || !Object.hasOwn(draftState.savesWorkspaces, id)
            || !name.trim() || name.trim().length > 120) return;
        workspace.name = name.trim();
    });
    registrar.regEvent(appIds.events.SAVES_REMOVE_WORKSPACE, ({ draftState }, id) => {
        if (draftState.savesStorageError === 'load' || !Object.hasOwn(draftState.savesWorkspaces, id)) return;
        const order = workspaceIds(draftState.savesWorkspaces, draftState.savesWorkspaceOrder);
        const index = order.indexOf(id);
        const wasActive = getActiveSaveWorkspace(draftState)?.id === id;
        delete draftState.savesWorkspaces[id];
        delete draftState.savesSelections[id];
        delete draftState.savesMapViewports[id];
        delete draftState.savesMapSelectedNodes[id];
        delete draftState.savesMapBuildingFilters[id];
        draftState.savesWorkspaceOrder = order.filter(entry => entry !== id);
        if (wasActive) {
            draftState.plannerComparisonCoreIds = [];
            draftState.savesActiveWorkspaceId = draftState.savesWorkspaceOrder[Math.max(0, index - 1)] ?? draftState.savesWorkspaceOrder[0] ?? null;
        }
        if (draftState.savesImport.targetWorkspaceId === id) {
            draftState.savesImport = createSaveImportState(draftState.savesImport.requestId + 1);
            return [[appIds.effects.savesCancelImport]];
        }
    });
    registrar.regEvent(appIds.events.SAVES_SET_MAP_VIEWPORT, ({ draftState }, id, x, y, zoom) => {
        if (!Object.hasOwn(draftState.savesWorkspaces, id) || ![x, y, zoom].every(Number.isFinite)
            || zoom < 0.005 || zoom > 3) return;
        const previous = draftState.savesMapViewports[id];
        if (previous?.x === x && previous.y === y && previous.zoom === zoom) return;
        draftState.savesMapViewports[id] = { x, y, zoom };
    });
    registrar.regEvent(appIds.events.SAVES_SELECT_MAP_NODE, ({ draftState }, id, nodeId) => {
        if (!Object.hasOwn(draftState.savesWorkspaces, id)) return;
        if (nodeId === null) { delete draftState.savesMapSelectedNodes[id]; return; }
        if (draftState.savesMapSelectedNodes[id] === nodeId) return;
        const snapshot = draftState.savesWorkspaces[id].snapshot;
        if (snapshot.cores.some(core => core.id === nodeId || core.buildings.some(building => building.id === nodeId))) {
            draftState.savesMapSelectedNodes[id] = nodeId;
        }
    });
    registrar.regEvent(appIds.events.SAVES_SET_MAP_DISPLAY, ({ draftState }, display) => {
        draftState.savesMapDisplay = normalizeMapDisplay(display);
    });
    registrar.regEvent(appIds.events.SAVES_SET_MAP_LAYERS, ({ draftState }, layers) => {
        draftState.savesMapLayers = normalizeMapLayers(layers);
    });
    registrar.regEvent(appIds.events.SAVES_SET_MAP_BUILDING_FILTER, ({ draftState }, id, buildingTypeIds) => {
        if (!Object.hasOwn(draftState.savesWorkspaces, id)) return;
        if (buildingTypeIds === null) {
            delete draftState.savesMapBuildingFilters[id];
            return;
        }
        const buildings = draftState.savesWorkspaces[id].snapshot.cores.flatMap(core => core.buildings);
        const available = new Set(buildings.map(building => building.buildingTypeId));
        const selected = [...new Set(buildingTypeIds)].filter(typeId => available.has(typeId));
        if (selected.length < available.size) draftState.savesMapBuildingFilters[id] = selected;
        else delete draftState.savesMapBuildingFilters[id];
        const inspected = buildings.find(building => building.id === draftState.savesMapSelectedNodes[id]);
        if (inspected && !selected.includes(inspected.buildingTypeId)) {
            delete draftState.savesMapSelectedNodes[id];
        }
    });
    registrar.regEvent(appIds.events.SAVES_SELECT_VIEW, ({ draftState }, view) => {
        if (view === 'map' || view === 'overview' || view === 'power-networks') draftState.savesSelectedView = view;
    });
    registrar.regEvent(appIds.events.SAVES_SELECT_CORE, ({ draftState }, id, coreId) => {
        const workspace = draftState.savesWorkspaces[id];
        if (draftState.savesStorageError === 'load' || !Object.hasOwn(draftState.savesWorkspaces, id)) return;
        if (coreId !== null && !workspace.snapshot.cores.some(core => core.id === coreId)) return;
        draftState.savesSelections[id] = { coreId };
    });
    registrar.regEvent(appIds.events.SAVES_OPEN_CORE_ON_MAP, ({ draftState }, id, coreId) => {
        if (draftState.savesStorageError === 'load' || !Object.hasOwn(draftState.savesWorkspaces, id)) return;
        if (!draftState.savesWorkspaces[id].snapshot.cores.some(core => core.id === coreId)) return;
        draftState.savesSelections[id] = { coreId: null };
        draftState.savesMapSelectedNodes[id] = coreId;
        // Fit the requested Core on mount instead of restoring the previous camera.
        delete draftState.savesMapViewports[id];
        draftState.savesSelectedView = 'map';
    });
    registrar.regEvent(appIds.events.SAVES_STORAGE_FAILED, ({ draftState }, error) => {
        // A later write diagnostic must not hide a failed load.
        if (draftState.savesStorageError !== 'load') draftState.savesStorageError = error;
    });
};
