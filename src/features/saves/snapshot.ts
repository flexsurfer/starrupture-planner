/** App data only. Source coordinates, fragments and runtime state never cross this boundary. */
export interface SaveSnapshot {
    schemaVersion: 3;
    gameData: { version: string; revision: string };
    savedAt: string | null;
    cores: SaveCore[];
}

export interface SaveCore {
    id: number;
    spawnTimeSeconds: number;
    name: string | null;
    /** Zero-based upgrade level; null when the save has no unambiguous value. */
    level: number | null;
    powerNetworkId: number | null;
    buildings: SaveBuilding[];
}

export type SaveNodePurity = 'impure' | 'normal' | 'pure' | 'not-applicable';
export type SaveBuildingConfiguration =
    | { kind: 'production'; recipeId: string | null }
    | { kind: 'extractor'; itemId: string | null; nodePurity: SaveNodePurity | null }
    | { kind: 'dispatcher'; itemId: string | null; receiverId: number | null }
    | { kind: 'receiver' }
    | { kind: 'launcher'; itemId: string | null }
    | { kind: 'other' };

export interface SaveBuilding {
    /** Snapshot-local reference, also used by dispatcher connections. */
    id: number;
    /** Includes the building version (e.g. V.2). */
    buildingTypeId: string;
    name: string | null;
    powerNetworkId: number | null;
    configuration: SaveBuildingConfiguration;
}

/** Only meaningful within one workspace. Never use building IDs to reconcile snapshots. */
export const coreKey = (core: Pick<SaveCore, 'id' | 'spawnTimeSeconds'>): string => `${core.id}:${core.spawnTimeSeconds}`;
