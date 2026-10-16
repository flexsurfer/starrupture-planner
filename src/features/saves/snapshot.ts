/** App data only. Raw fragments and game runtime state never cross this boundary. */
export interface SaveSnapshot {
    schemaVersion: 1;
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
    position: SavePosition;
    /** Saved Core bounds; null when unavailable, including older imports. */
    bounds: SaveBounds | null;
    buildings: SaveBuilding[];
}

/** World coordinates in the save's units. Z is retained for stacked buildings. */
export interface SavePosition { x: number; y: number; z: number }

export interface SaveBounds { min: SavePosition; max: SavePosition }

export const isValidSaveBounds = ({ min, max }: SaveBounds): boolean =>
    (['x', 'y', 'z'] as const).every(axis => Number.isFinite(min[axis]) && Number.isFinite(max[axis])
        && max[axis] > min[axis] && Number.isFinite(max[axis] - min[axis]));

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
    position: SavePosition;
    configuration: SaveBuildingConfiguration;
}

/** Only meaningful within one workspace. Never use building IDs to reconcile snapshots. */
export const coreKey = (core: Pick<SaveCore, 'id' | 'spawnTimeSeconds'>): string => `${core.id}:${core.spawnTimeSeconds}`;
