import type { AppVersionedGameData, Building, Item, RawCorporationsData } from './model';

export type GameDataBundle = {
    items: unknown;
    buildings: unknown;
    corporations: RawCorporationsData;
};

/** Converts an external game-data payload before it enters the application runtime. */
export function gameDataBundleToAppVersioned(raw: GameDataBundle): AppVersionedGameData {
    return {
        items: raw.items as Item[],
        buildings: raw.buildings as Building[],
        corporations: raw.corporations,
    };
}
