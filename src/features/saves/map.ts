import type { SaveGameData } from './game-data';
import type { SaveBuildingView, SaveCoreOverview, SaveOverview } from './overview';
import type { SavePosition } from './snapshot';
import { buildBuildingStacks } from './building-stacks';
import { buildBuildingLevels } from './building-levels';
import { defaultMapDisplay } from './map-preferences';

export interface SaveMapEntity {
    id: number;
    position: SavePosition;
    core: SaveCoreOverview;
    coreNumber: number;
    /** Null represents the Core itself. */
    detail: SaveBuildingView | null;
    /** One-based overlap depth; the Core marker has no building level. */
    level: number | null;
    inputs: { itemId: string; name: string; rate: number }[];
    connectedBuildingId: number | null;
}

export interface SaveMapLink {
    source: number;
    target: number;
    item: { id: string; name: string } | null;
}

export interface SaveMapCoreLink {
    source: number;
    target: number;
    items: SaveMapLink['item'][];
    bidirectional: boolean;
}

/** Derive marker overlap levels and direct cargo links without relocating saved positions. */
export function buildSaveMap(overview: SaveOverview, data: SaveGameData, buildingSize = defaultMapDisplay.buildingSize) {
    const entities: SaveMapEntity[] = [];
    const links: SaveMapLink[] = [];
    const buildings = overview.buildingDetails.map(detail => detail.instance);
    const detailsById = new Map(overview.buildingDetails.map(detail => [detail.instance.id, detail]));
    const stacks = buildBuildingStacks(buildings, buildingSize);
    const levels = buildBuildingLevels(buildings, stacks);
    const levelCountsByCore = new Map<number, number>();
    for (const [index, core] of overview.cores.entries()) {
        const common = { core, coreNumber: index + 1 };
        const levelCount = core.buildings.reduce((max, building) => Math.max(max, levels.get(building.id)!), 0);
        entities.push({ ...common, id: core.core.id, position: core.core.position, detail: null, level: null, inputs: [], connectedBuildingId: null });
        // The snapshot's unique grouping is only a stable map anchor, not coverage.
        for (const instance of core.core.buildings) {
            const detail = detailsById.get(instance.id)!;
            const { configuration: config } = detail.instance;
            const level = levels.get(detail.instance.id)!;
            const recipe = config.kind === 'production' && config.recipeId ? data.recipes.get(config.recipeId)?.recipe : null;
            entities.push({ ...common, id: detail.instance.id, position: detail.instance.position, detail, level, connectedBuildingId: null,
                inputs: (recipe?.inputs ?? []).map(input => ({ itemId: input.id, name: data.items.get(input.id)?.name ?? input.id, rate: input.amount_per_minute })) });
            if (config.kind === 'dispatcher' && config.receiverId !== null) {
                const item = config.itemId ? data.items.get(config.itemId) : null;
                links.push({ source: detail.instance.id, target: config.receiverId, item: item ? { id: item.id, name: item.name } : null });
            }
        }
        levelCountsByCore.set(core.core.id, levelCount);
    }
    const byId = new Map(entities.map(entity => [entity.id, entity]));
    for (const link of links) {
        const sender = byId.get(link.source)!, receiver = byId.get(link.target)!;
        sender.connectedBuildingId = link.target;
        receiver.connectedBuildingId = link.source;
    }
    return { entities, links, coreLinks: buildMapCoreLinks(entities, links), levelCountsByCore, stacks, buildingSize };
}

/** Aggregate only the supplied building links, including when the map is filtered. */
export function buildMapCoreLinks(entities: readonly SaveMapEntity[], links: readonly SaveMapLink[]): SaveMapCoreLink[] {
    const byId = new Map(entities.map(entity => [entity.id, entity]));
    const coreLinks = new Map<string, SaveMapCoreLink>();
    for (const link of links) {
        const sender = byId.get(link.source)!, receiver = byId.get(link.target)!;
        const sourceCores = new Set(sender.detail!.cores.map(core => core.id));
        const targetCores = new Set(receiver.detail!.cores.map(core => core.id));
        const externalTargets = [...targetCores].filter(id => !sourceCores.has(id));
        // Aggregate actual coverage crossings. A pair is local when both Cores
        // contain both endpoints; uncovered endpoints keep only their physical link.
        // Shared source Cores need only visit targets outside the shared area.
        for (const source of sourceCores) for (const target of targetCores.has(source) ? externalTargets : targetCores) {
            const key = `${source}:${target}`;
            const route = coreLinks.get(key) ?? { source, target, items: [], bidirectional: false };
            if (!route.items.some(item => item?.id === link.item?.id)) route.items.push(link.item);
            coreLinks.set(key, route);
        }
    }
    for (const route of coreLinks.values()) route.bidirectional = coreLinks.has(`${route.target}:${route.source}`);
    return [...coreLinks.values()];
}

export type SaveMap = ReturnType<typeof buildSaveMap>;
