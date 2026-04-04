/**
 * Items Package Type Definitions
 */

import type {
  Corporation as DbCorporation,
  CorporationComponent as DbCorporationComponent,
  CorporationLevel as DbCorporationLevel,
  Item as DbItem,
} from '../../state/db';

export type Item = DbItem;
export type CorporationComponent = DbCorporationComponent;
export type CorporationLevel = DbCorporationLevel;
export type CorporationData = Pick<DbCorporation, 'id' | 'levels'>;

export type CorporationsData = Record<string, CorporationData>;

// Corporation usage information
export interface CorporationUsage {
  corporation: string;
  level: number;
}

/** Item row view-model used by item table subscriptions/components. */
export interface ItemTableData {
  item: Item;
  producingBuildings: string[];
  corporationUsage: CorporationUsage[];
}

/** Shared helper lookups used in item/corporation views. */
export interface ItemsHelperLookups {
  corporationNameToId: Map<string, string>;
  buildingCorporationUsage: Map<string, CorporationUsage[]>;
}
