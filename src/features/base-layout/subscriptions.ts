import type { UkladModule, UkladRegistrar } from "@ukladjs/core/vanilla";
import { appIds, stateKeys } from "@/app/uklad/catalog";
import type { AppContracts } from "@/app/uklad/contracts";
import type { BuildingProductionState } from "./utils/layoutBalanceCalculator";
import {
  calculateConnectionTransferRates,
  calculateLayoutBalance,
  calculateVirtualLayoutBalance,
  computeVirtualEdges,
} from "./utils/layoutBalanceCalculator";

const S = appIds.subscriptions;

export const registerBaseLayoutSubscriptions: UkladModule<
  UkladRegistrar<AppContracts>
> = (registrar) => {
  registrar.regRootSub(
    S.BASE_LAYOUT_POINTER_MODE,
    stateKeys.baseLayoutPointerMode,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_CONNECTOR_MODE,
    stateKeys.baseLayoutConnectorMode,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_TRANSFER_MODE,
    stateKeys.baseLayoutTransferMode,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_SELECTED_RAIL_TIER,
    stateKeys.baseLayoutSelectedRailTier,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_ITEM_PALETTE_MODE,
    stateKeys.baseLayoutItemPaletteMode,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_SELECTED_BUILDING_IDS,
    stateKeys.baseLayoutSelectedBuildingIds,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_SELECTED_BUILDING_ID,
    stateKeys.baseLayoutSelectedBuildingId,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_SELECTED_CONNECTION_IDS,
    stateKeys.baseLayoutSelectedConnectionIds,
  );
  registrar.regRootSub(
    S.BASE_LAYOUT_SELECTED_CONNECTION_ID,
    stateKeys.baseLayoutSelectedConnectionId,
  );

  registrar.regSub(
    S.BASE_LAYOUT_BY_BASE_ID,
    (baseId) => [[appIds.subscriptions.BASES_BASE_BY_ID, baseId]],
    ([base]) => base?.layout,
  );

  registrar.regSub(
    S.BASE_LAYOUT_BUILDINGS_BY_BASE_ID,
    (baseId) => [[S.BASE_LAYOUT_BY_BASE_ID, baseId]],
    ([layout]) => layout?.buildings ?? [],
  );

  registrar.regSub(
    S.BASE_LAYOUT_CONNECTIONS_BY_BASE_ID,
    (baseId) => [[S.BASE_LAYOUT_BY_BASE_ID, baseId]],
    ([layout]) => layout?.connections ?? [],
  );

  // Combined result for internal use: both balances and per-building states.
  registrar.regSub(
    S.BASE_LAYOUT_BALANCE_RESULT_BY_BASE_ID,
    (baseId) => [
      [S.BASE_LAYOUT_BY_BASE_ID, baseId],
      [S.BUILDINGS_BY_ID_MAP],
      [S.BASE_LAYOUT_TRANSFER_MODE],
    ],
    ([layout, buildingsById, transferMode]) =>
      transferMode === "virtual"
        ? calculateVirtualLayoutBalance(layout, buildingsById)
        : calculateLayoutBalance(layout, buildingsById),
  );

  registrar.regSub(
    S.BASE_LAYOUT_BALANCE_BY_BASE_ID,
    (baseId) => [[S.BASE_LAYOUT_BALANCE_RESULT_BY_BASE_ID, baseId]],
    ([result]) => result.balances,
  );

  // Building production states as a plain object so change detection works on it.
  registrar.regSub(
    S.BASE_LAYOUT_BUILDING_STATES_BY_BASE_ID,
    (baseId) => [[S.BASE_LAYOUT_BALANCE_RESULT_BY_BASE_ID, baseId]],
    ([result]) => {
      const states: Record<string, BuildingProductionState> = {};
      result.buildingStates.forEach((state, id) => {
        states[id] = state;
      });
      return states;
    },
  );

  // Per-connection current/max throughput.
  registrar.regSub(
    S.BASE_LAYOUT_CONNECTION_TRANSFER_RATES,
    (baseId) => [
      [S.BASE_LAYOUT_BALANCE_RESULT_BY_BASE_ID, baseId],
      [S.BASE_LAYOUT_BY_BASE_ID, baseId],
    ],
    ([result, layout]) => {
      const rates: Record<
        string,
        ReturnType<typeof calculateConnectionTransferRates> extends Map<
          string,
          infer V
        >
          ? V
          : never
      > = {};
      calculateConnectionTransferRates(layout, result.buildingStates).forEach(
        (rate, id) => {
          rates[id] = rate;
        },
      );
      return rates;
    },
  );

  // Edges to/from buildings exchanging items with the selection in virtual transfer mode.
  registrar.regSub(
    S.BASE_LAYOUT_VIRTUAL_EDGES_FOR_SELECTION,
    (baseId) => [
      [S.BASE_LAYOUT_TRANSFER_MODE],
      [S.BASE_LAYOUT_SELECTED_BUILDING_ID],
      [S.BASE_LAYOUT_BUILDING_STATES_BY_BASE_ID, baseId],
      [S.BASE_LAYOUT_BY_BASE_ID, baseId],
    ],
    ([transferMode, selectedBuildingId, buildingStates, layout]) =>
      transferMode !== "virtual" || !selectedBuildingId || !layout
        ? []
        : computeVirtualEdges(
            selectedBuildingId,
            layout.buildings,
            buildingStates,
          ),
  );
};
