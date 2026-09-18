import type {
  BaseLayoutPointerMode,
  ItemPaletteMode,
  RailTier,
  TransferMode,
} from "@/app/uklad/model";

export interface BaseLayoutFeatureState {
  baseLayoutPointerMode: BaseLayoutPointerMode; // Active pointer tool for the layout canvas
  baseLayoutConnectorMode: RailTier | null; // Active connector mode for creating connections
  baseLayoutTransferMode: TransferMode; // Whether explicit (physical) or implicit (virtual) transfers are used
  baseLayoutSelectedRailTier: RailTier; // Rail tier used for new connections
  baseLayoutSelectedBuildingIds: string[];
  baseLayoutSelectedBuildingId: string | null;
  baseLayoutSelectedConnectionIds: string[];
  baseLayoutSelectedConnectionId: string | null;
  baseLayoutItemPaletteMode: ItemPaletteMode;
}

/** Creates the transient (non-persisted) layout editor state. */
export function createBaseLayoutFeatureState(): BaseLayoutFeatureState {
  return {
    baseLayoutPointerMode: "pan",
    baseLayoutConnectorMode: null,
    baseLayoutTransferMode: "virtual",
    baseLayoutSelectedRailTier: 1,
    baseLayoutSelectedBuildingIds: [],
    baseLayoutSelectedBuildingId: null,
    baseLayoutSelectedConnectionIds: [],
    baseLayoutSelectedConnectionId: null,
    baseLayoutItemPaletteMode: "production_v1",
  };
}
