import { isRawExtractor } from '@/features/bases/building-section';
import { buildMapCoreLinks, type SaveMap } from './map';
import type { SaveBuildingView } from './overview';

const buildingTypeOrder = {
    extractor: 0, production: 1, transport: 2, storage: 3, generator: 4, temperature: 5, other: 6,
} as const;

export type MapBuildingCategory = keyof typeof buildingTypeOrder;
export interface MapBuildingType { id: string; name: string; count: number; category: MapBuildingCategory }

function buildingTypeCategory({ building, instance }: SaveBuildingView): MapBuildingCategory {
    const kind = instance.configuration.kind;
    if (kind === 'extractor' || isRawExtractor(building)) return 'extractor';
    const type = building.type ?? (kind === 'dispatcher' || kind === 'receiver' || kind === 'launcher' ? 'transport' : kind);
    return Object.hasOwn(buildingTypeOrder, type) ? type as MapBuildingCategory : 'other';
}

export function mapBuildingTypes(map: SaveMap): MapBuildingType[] {
    const types = new Map<string, MapBuildingType>();
    for (const { detail } of map.entities) {
        if (!detail) continue;
        const id = detail.instance.buildingTypeId;
        const type = types.get(id);
        if (type) type.count++;
        else types.set(id, { id, name: detail.building.name, count: 1, category: buildingTypeCategory(detail) });
    }
    return [...types.values()].sort((a, b) => buildingTypeOrder[a.category] - buildingTypeOrder[b.category]
        || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Filter the rendered map without changing saved geometry or overlap levels. */
export function filterSaveMap(map: SaveMap, selectedTypes: readonly string[]): SaveMap {
    const selected = new Set(selectedTypes);
    const entities = map.entities.filter(entity => !entity.detail || selected.has(entity.detail.instance.buildingTypeId));
    if (entities.length === map.entities.length) return map;
    const visibleIds = new Set(entities.map(entity => entity.id));
    const links = map.links.filter(link => visibleIds.has(link.source) && visibleIds.has(link.target));
    const stacks = new Map([...map.stacks].filter(([id]) => visibleIds.has(id)).map(([id, stack]) => [id, {
        above: stack.above.filter(peer => visibleIds.has(peer)),
        below: stack.below.filter(peer => visibleIds.has(peer)),
    }]));
    return { ...map, entities, links, coreLinks: buildMapCoreLinks(entities, links), stacks };
}
