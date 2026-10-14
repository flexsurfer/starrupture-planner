import type { SaveGameData } from './game-data';
import type { SaveBuildingView, SaveCoreOverview, SaveOverview } from './overview';
import type { SavePosition } from './snapshot';

export interface SaveMapEntity {
    id: number;
    position: SavePosition;
    core: SaveCoreOverview;
    coreNumber: number;
    /** Null represents the Core itself. */
    detail: SaveBuildingView | null;
    inputs: { itemId: string; name: string; rate: number }[];
    connectedBuildingId: number | null;
}

export interface SaveMapLink {
    source: number;
    target: number;
    item: { id: string; name: string } | null;
}

/** One pass over supported entities and direct cargo references; no route inference or layout. */
export function buildSaveMap(overview: SaveOverview, data: SaveGameData) {
    const entities: SaveMapEntity[] = [];
    const links: SaveMapLink[] = [];
    for (const [index, core] of overview.cores.entries()) {
        const common = { core, coreNumber: index + 1 };
        entities.push({ ...common, id: core.core.id, position: core.core.position, detail: null, inputs: [], connectedBuildingId: null });
        for (const detail of core.buildingDetails) {
            const { configuration: config } = detail.instance;
            const recipe = config.kind === 'production' && config.recipeId ? data.recipes.get(config.recipeId)?.recipe : null;
            entities.push({ ...common, id: detail.instance.id, position: detail.instance.position, detail, connectedBuildingId: null,
                inputs: (recipe?.inputs ?? []).map(input => ({ itemId: input.id, name: data.items.get(input.id)?.name ?? input.id, rate: input.amount_per_minute })) });
            if (config.kind === 'dispatcher' && config.receiverId !== null) {
                const item = config.itemId ? data.items.get(config.itemId) : null;
                links.push({ source: detail.instance.id, target: config.receiverId, item: item ? { id: item.id, name: item.name } : null });
            }
        }
    }
    const byId = new Map(entities.map(entity => [entity.id, entity]));
    for (const link of links) {
        byId.get(link.source)!.connectedBuildingId = link.target;
        byId.get(link.target)!.connectedBuildingId = link.source;
    }
    return { entities, links };
}

export type SaveMap = ReturnType<typeof buildSaveMap>;
