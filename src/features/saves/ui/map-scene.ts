import type { MapNode } from './SaveMapNode';
import type { CargoEdge } from './SaveMapEdge';

/** Derived render cache only: never changes the map model or runtime-owned data. */
export function createMapNodeProjector() {
    let cache = new Map<MapNode, MapNode>();
    let result: MapNode[] = [];
    return (base: MapNode[], ghosts: ReadonlySet<number>, selectedId: number | undefined,
        relatedId: number | null | undefined, selectedCoreIds: ReadonlySet<number>, showBuildings: boolean, showBounds: boolean) => {
        const next = new Map<MapNode, MapNode>();
        const nodes: MapNode[] = [];
        for (const node of base) {
            const bounds = node.type === 'saveCoreBounds';
            if (bounds && !showBounds) continue;
            const { entity } = node.data;
            const selected = bounds ? selectedCoreIds.has(entity.id) : entity.id === selectedId;
            const related = !bounds && entity.id === relatedId;
            const ghost = !bounds && ghosts.has(entity.id);
            const hidden = Boolean(entity.detail) && !showBuildings;
            const previous = cache.get(node);
            const rendered = previous && previous.hidden === hidden && previous.data.selected === selected
                && previous.data.related === related && previous.data.ghost === ghost ? previous : {
                    ...node, hidden, data: { ...node.data, selected, related, ghost },
                    style: ghost ? { ...node.style, pointerEvents: 'none' as const } : node.style,
                    zIndex: node.zIndex! + (entity.detail && (selected || related) ? 1 : 0),
                };
            next.set(node, rendered);
            nodes.push(rendered);
        }
        cache = next;
        if (nodes.length !== result.length || nodes.some((node, index) => node !== result[index])) result = nodes;
        return result;
    };
}

export function createCargoEdgeProjector() {
    let cache = new Map<CargoEdge, CargoEdge>();
    let result: CargoEdge[] = [];
    return (base: CargoEdge[], ghosts: ReadonlySet<number>, selectedIds: ReadonlySet<number>, visible: boolean, animate: boolean) => {
        const next = new Map<CargoEdge, CargoEdge>();
        const edges: CargoEdge[] = [];
        for (const edge of visible ? base : []) {
            if (ghosts.has(Number(edge.source)) || ghosts.has(Number(edge.target))) continue;
            const highlighted = selectedIds.has(Number(edge.source)) || selectedIds.has(Number(edge.target));
            const dimmed = !highlighted && selectedIds.size > 0;
            const previous = cache.get(edge);
            const rendered = previous && previous.data?.highlighted === highlighted && previous.data.dimmed === dimmed
                && previous.data.animate === animate ? previous : {
                    ...edge, data: { ...edge.data, highlighted, dimmed, animate }, label: highlighted ? edge.label : undefined,
                };
            next.set(edge, rendered);
            edges.push(rendered);
        }
        cache = next;
        if (edges.length !== result.length || edges.some((edge, index) => edge !== result[index])) result = edges;
        return result;
    };
}
