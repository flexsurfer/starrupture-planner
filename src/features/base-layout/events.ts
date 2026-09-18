import type { UkladModule, UkladRegistrar } from "@ukladjs/core/vanilla";
import { appIds } from "@/app/uklad/catalog";
import type { AppContracts } from "@/app/uklad/contracts";
import type {
  Base,
  BaseLayout,
  BaseLayoutBuilding,
  Building,
  LayoutBuildingType,
} from "@/app/uklad/model";
import {
  PACKAGE_DISPATCHER_BUILDING_ID,
  PACKAGE_RECEIVER_BUILDING_ID,
} from "@/constants/buildingIds";
import { resolveLayoutBuildingRecipe } from "./recipe-resolution";

const DEFAULT_PACKAGE_RATE = 100;

function getBaseById(bases: Base[], baseId: string): Base | undefined {
  return bases.find((base) => base.id === baseId);
}

function createLayout(): BaseLayout {
  return {
    buildings: [],
    connections: [],
    gridOffsetX: 0,
    gridOffsetY: 0,
    transferMode: "virtual",
  };
}

function createEntityId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function areIdsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function getSelectedLayout(
  bases: Base[],
  selectedBaseId: string | null,
): BaseLayout | undefined {
  return selectedBaseId
    ? getBaseById(bases, selectedBaseId)?.layout
    : undefined;
}

export const registerBaseLayoutEvents: UkladModule<
  UkladRegistrar<AppContracts>
> = (registrar) => {
  /** Initialize the layout if it doesn't exist and sync the editor's transfer mode from it. */
  registrar.regEvent(
    appIds.events.BASE_LAYOUT_INIT,
    ({ draftState }, baseId) => {
      const base = getBaseById(draftState.basesList, baseId);
      if (!base) return;

      base.layout ??= createLayout();
      base.layout.transferMode ??= "virtual";
      draftState.baseLayoutTransferMode = base.layout.transferMode;

      // Building card mode is transient; whenever a layout is opened, normalize to summary.
      for (const building of base.layout.buildings) {
        if (building.mode !== "summary") building.mode = "summary";
      }
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_ADD_BUILDING,
    (
      { draftState },
      baseId,
      x,
      y,
      itemId,
      buildingId,
      recipeIndex,
      buildingType,
      receiverOutputRate,
      dispatcherInputRate,
    ) => {
      const base = getBaseById(draftState.basesList, baseId);
      if (!base) return;

      base.layout ??= createLayout();
      if (base.layout.buildings.some((b) => b.x === x && b.y === y)) return;

      // Treat the package receiver/dispatcher building ids as such even when buildingType is omitted.
      const resolvedBuildingType: LayoutBuildingType | undefined =
        buildingType ??
        (buildingId === PACKAGE_RECEIVER_BUILDING_ID
          ? "receiver"
          : buildingId === PACKAGE_DISPATCHER_BUILDING_ID
            ? "dispatcher"
            : undefined);

      const layoutBuilding: BaseLayoutBuilding = {
        id: createEntityId("layout_building"),
        x,
        y,
        itemId,
        buildingId,
        recipeIndex,
        count: 1,
      };
      if (resolvedBuildingType && resolvedBuildingType !== "production") {
        layoutBuilding.buildingType = resolvedBuildingType;
        if (resolvedBuildingType === "receiver")
          layoutBuilding.receiverOutputRate =
            receiverOutputRate || DEFAULT_PACKAGE_RATE;
        if (resolvedBuildingType === "dispatcher")
          layoutBuilding.dispatcherInputRate =
            dispatcherInputRate || DEFAULT_PACKAGE_RATE;
      }
      base.layout.buildings.push(layoutBuilding);
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_REMOVE_BUILDING,
    ({ draftState }, baseId, layoutBuildingId) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout) return;

      const removedSelectedConnection = layout.connections.some(
        (connection) =>
          connection.id === draftState.baseLayoutSelectedConnectionId &&
          (connection.fromBuildingId === layoutBuildingId ||
            connection.toBuildingId === layoutBuildingId),
      );

      layout.buildings = layout.buildings.filter(
        (b) => b.id !== layoutBuildingId,
      );
      layout.connections = layout.connections.filter(
        (c) =>
          c.fromBuildingId !== layoutBuildingId &&
          c.toBuildingId !== layoutBuildingId,
      );

      if (draftState.baseLayoutSelectedBuildingId === layoutBuildingId)
        draftState.baseLayoutSelectedBuildingId = null;
      draftState.baseLayoutSelectedBuildingIds =
        draftState.baseLayoutSelectedBuildingIds.filter(
          (id) => id !== layoutBuildingId,
        );
      if (removedSelectedConnection) {
        draftState.baseLayoutSelectedConnectionId = null;
        draftState.baseLayoutSelectedConnectionIds = [];
      }
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_MOVE_BUILDING,
    ({ draftState }, baseId, layoutBuildingId, newX, newY) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      const building = layout?.buildings.find((b) => b.id === layoutBuildingId);
      if (!layout || !building) return;
      if (
        layout.buildings.some(
          (b) => b.id !== layoutBuildingId && b.x === newX && b.y === newY,
        )
      )
        return;

      building.x = newX;
      building.y = newY;
    },
  );

  /** Moves several buildings atomically; rejects the whole move on any collision. */
  registrar.regEvent(
    appIds.events.BASE_LAYOUT_MOVE_BUILDINGS,
    ({ draftState }, baseId, moves) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout || moves.length === 0) return;

      const moveIds = new Set(moves.map((move) => move.layoutBuildingId));
      const moveMap = new Map(
        moves.map((move) => [
          move.layoutBuildingId,
          { x: move.newX, y: move.newY },
        ]),
      );
      if (
        moves.some(
          (move) =>
            !layout.buildings.some((b) => b.id === move.layoutBuildingId),
        )
      )
        return;

      const targetPositions = new Set<string>();
      for (const move of moves) {
        const positionKey = `${move.newX},${move.newY}`;
        if (targetPositions.has(positionKey)) return;
        targetPositions.add(positionKey);
      }

      const blocked = layout.buildings.some(
        (b) => !moveIds.has(b.id) && targetPositions.has(`${b.x},${b.y}`),
      );
      if (blocked) return;

      for (const building of layout.buildings) {
        const next = moveMap.get(building.id);
        if (!next) continue;
        building.x = next.x;
        building.y = next.y;
      }
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_UPDATE_BUILDING_COUNT,
    ({ draftState }, baseId, layoutBuildingId, count) => {
      const building = getBaseById(
        draftState.basesList,
        baseId,
      )?.layout?.buildings.find((b) => b.id === layoutBuildingId);
      if (building) building.count = Math.max(1, Math.round(count));
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_UPDATE_RECEIVER_OUTPUT_RATE,
    ({ draftState }, baseId, layoutBuildingId, outputRate) => {
      const building = getBaseById(
        draftState.basesList,
        baseId,
      )?.layout?.buildings.find((b) => b.id === layoutBuildingId);
      if (building?.buildingType === "receiver")
        building.receiverOutputRate = Math.max(1, outputRate);
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_UPDATE_DISPATCHER_INPUT_RATE,
    ({ draftState }, baseId, layoutBuildingId, inputRate) => {
      const building = getBaseById(
        draftState.basesList,
        baseId,
      )?.layout?.buildings.find((b) => b.id === layoutBuildingId);
      if (building?.buildingType === "dispatcher")
        building.dispatcherInputRate = Math.max(1, inputRate);
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_ADD_CONNECTION,
    (
      { draftState },
      baseId,
      fromBuildingId,
      toBuildingId,
      itemId,
      railTier,
    ) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout || fromBuildingId === toBuildingId) return;

      const source = layout.buildings.find((b) => b.id === fromBuildingId);
      const target = layout.buildings.find((b) => b.id === toBuildingId);
      if (!source || !target) return;

      const buildingsById = new Map<string, Building>(
        draftState.buildingsList.map((building) => [building.id, building]),
      );
      const sourceDef = buildingsById.get(source.buildingId);
      const targetDef = buildingsById.get(target.buildingId);
      if (!sourceDef || !targetDef) return;

      if (source.buildingType === "receiver") {
        if (source.itemId !== itemId) return;
      } else {
        const sourceRecipe = resolveLayoutBuildingRecipe(source, sourceDef);
        if (!sourceRecipe || sourceRecipe.output.id !== itemId) return;
      }

      const targetRecipe = resolveLayoutBuildingRecipe(target, targetDef);
      if (!targetRecipe?.inputs.some((input) => input.id === itemId)) return;

      const exists = layout.connections.some(
        (c) =>
          c.fromBuildingId === fromBuildingId &&
          c.toBuildingId === toBuildingId &&
          c.itemId === itemId,
      );
      if (exists) return;

      layout.connections.push({
        id: createEntityId("layout_connection"),
        fromBuildingId,
        toBuildingId,
        itemId,
        railTier,
      });
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_REMOVE_CONNECTION,
    ({ draftState }, baseId, connectionId) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout) return;

      layout.connections = layout.connections.filter(
        (c) => c.id !== connectionId,
      );
      draftState.baseLayoutSelectedConnectionIds =
        draftState.baseLayoutSelectedConnectionIds.filter(
          (id) => id !== connectionId,
        );
      if (draftState.baseLayoutSelectedConnectionId === connectionId)
        draftState.baseLayoutSelectedConnectionId = null;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_UPDATE_CONNECTION_TIER,
    ({ draftState }, baseId, connectionId, railTier) => {
      const connection = getBaseById(
        draftState.basesList,
        baseId,
      )?.layout?.connections.find((c) => c.id === connectionId);
      if (connection) connection.railTier = railTier;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_GRID_OFFSET,
    ({ draftState }, baseId, offsetX, offsetY) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout) return;
      layout.gridOffsetX = offsetX;
      layout.gridOffsetY = offsetY;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_POINTER_MODE,
    ({ draftState }, mode) => {
      draftState.baseLayoutPointerMode = mode;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_CONNECTOR_MODE,
    ({ draftState }, railTier) => {
      draftState.baseLayoutConnectorMode = railTier;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_TRANSFER_MODE,
    ({ draftState }, mode) => {
      draftState.baseLayoutTransferMode = mode;

      const layout = getSelectedLayout(
        draftState.basesList,
        draftState.basesSelectedBaseId,
      );
      if (layout && layout.transferMode !== mode) layout.transferMode = mode;

      // Clear any in-progress connector drag when entering virtual mode.
      if (mode === "virtual") draftState.baseLayoutConnectorMode = null;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_SELECTED_RAIL_TIER,
    ({ draftState }, railTier) => {
      draftState.baseLayoutSelectedRailTier = railTier;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_ITEM_PALETTE_MODE,
    ({ draftState }, mode) => {
      draftState.baseLayoutItemPaletteMode = mode;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_SELECTION,
    ({ draftState }, buildingIds = [], connectionIds = []) => {
      const nextBuildingId =
        buildingIds.length === 1 && connectionIds.length === 0
          ? buildingIds[0]
          : null;
      const nextConnectionId =
        connectionIds.length === 1 && buildingIds.length === 0
          ? connectionIds[0]
          : null;

      if (
        areIdsEqual(draftState.baseLayoutSelectedBuildingIds, buildingIds) &&
        areIdsEqual(
          draftState.baseLayoutSelectedConnectionIds,
          connectionIds,
        ) &&
        draftState.baseLayoutSelectedBuildingId === nextBuildingId &&
        draftState.baseLayoutSelectedConnectionId === nextConnectionId
      )
        return;

      draftState.baseLayoutSelectedBuildingIds = [...buildingIds];
      draftState.baseLayoutSelectedConnectionIds = [...connectionIds];
      draftState.baseLayoutSelectedBuildingId = nextBuildingId;
      draftState.baseLayoutSelectedConnectionId = nextConnectionId;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_SELECTED_BUILDING,
    ({ draftState }, buildingId) => {
      if (
        draftState.baseLayoutSelectedBuildingId === buildingId &&
        areIdsEqual(
          draftState.baseLayoutSelectedBuildingIds,
          buildingId ? [buildingId] : [],
        ) &&
        draftState.baseLayoutSelectedConnectionIds.length === 0 &&
        draftState.baseLayoutSelectedConnectionId === null
      )
        return;

      draftState.baseLayoutSelectedBuildingIds = buildingId ? [buildingId] : [];
      draftState.baseLayoutSelectedBuildingId = buildingId;
      draftState.baseLayoutSelectedConnectionIds = [];
      draftState.baseLayoutSelectedConnectionId = null;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_DELETE_SELECTED_BUILDING,
    ({ draftState }) => {
      const buildingIds = draftState.baseLayoutSelectedBuildingIds.length
        ? [...draftState.baseLayoutSelectedBuildingIds]
        : draftState.baseLayoutSelectedBuildingId
          ? [draftState.baseLayoutSelectedBuildingId]
          : [];
      if (buildingIds.length === 0) return;

      const layout = getSelectedLayout(
        draftState.basesList,
        draftState.basesSelectedBaseId,
      );
      if (!layout) return;

      const selected = new Set(buildingIds);
      const removedSelectedConnection = layout.connections.some(
        (connection) =>
          draftState.baseLayoutSelectedConnectionIds.includes(connection.id) &&
          (selected.has(connection.fromBuildingId) ||
            selected.has(connection.toBuildingId)),
      );

      layout.buildings = layout.buildings.filter((b) => !selected.has(b.id));
      layout.connections = layout.connections.filter(
        (c) => !selected.has(c.fromBuildingId) && !selected.has(c.toBuildingId),
      );

      draftState.baseLayoutSelectedBuildingIds = [];
      draftState.baseLayoutSelectedBuildingId = null;
      if (removedSelectedConnection) {
        draftState.baseLayoutSelectedConnectionIds = [];
        draftState.baseLayoutSelectedConnectionId = null;
      }
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_SELECTED_CONNECTION,
    ({ draftState }, connectionId) => {
      if (
        draftState.baseLayoutSelectedConnectionId === connectionId &&
        areIdsEqual(
          draftState.baseLayoutSelectedConnectionIds,
          connectionId ? [connectionId] : [],
        ) &&
        draftState.baseLayoutSelectedBuildingIds.length === 0 &&
        draftState.baseLayoutSelectedBuildingId === null
      )
        return;

      draftState.baseLayoutSelectedBuildingIds = [];
      draftState.baseLayoutSelectedBuildingId = null;
      draftState.baseLayoutSelectedConnectionIds = connectionId
        ? [connectionId]
        : [];
      draftState.baseLayoutSelectedConnectionId = connectionId;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_DELETE_SELECTED_CONNECTION,
    ({ draftState }) => {
      const connectionIds = draftState.baseLayoutSelectedConnectionIds.length
        ? [...draftState.baseLayoutSelectedConnectionIds]
        : draftState.baseLayoutSelectedConnectionId
          ? [draftState.baseLayoutSelectedConnectionId]
          : [];
      if (connectionIds.length === 0) return;

      const layout = getSelectedLayout(
        draftState.basesList,
        draftState.basesSelectedBaseId,
      );
      if (!layout) return;

      const selected = new Set(connectionIds);
      layout.connections = layout.connections.filter(
        (c) => !selected.has(c.id),
      );
      draftState.baseLayoutSelectedConnectionIds = [];
      draftState.baseLayoutSelectedConnectionId = null;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_TOGGLE_BUILDING_MODE,
    ({ draftState }, baseId, layoutBuildingId) => {
      const building = getBaseById(
        draftState.basesList,
        baseId,
      )?.layout?.buildings.find((b) => b.id === layoutBuildingId);
      if (!building) return;
      // undefined defaults to "edit"
      building.mode = (building.mode || "edit") === "edit" ? "summary" : "edit";
    },
  );

  /** Disabled buildings produce and consume nothing. */
  registrar.regEvent(
    appIds.events.BASE_LAYOUT_TOGGLE_BUILDING_ENABLED,
    ({ draftState }, baseId, layoutBuildingId) => {
      const building = getBaseById(
        draftState.basesList,
        baseId,
      )?.layout?.buildings.find((b) => b.id === layoutBuildingId);
      if (building) building.enabled = building.enabled === false;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_ALL_BUILDINGS_MODE,
    ({ draftState }, baseId, mode) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout) return;
      for (const building of layout.buildings) building.mode = mode;
    },
  );

  registrar.regEvent(
    appIds.events.BASE_LAYOUT_SET_ALL_BUILDINGS_DISTRIBUTION_MODE,
    ({ draftState }, baseId, mode) => {
      const layout = getBaseById(draftState.basesList, baseId)?.layout;
      if (!layout) return;
      for (const building of layout.buildings) building.distributionMode = mode;
    },
  );
};
