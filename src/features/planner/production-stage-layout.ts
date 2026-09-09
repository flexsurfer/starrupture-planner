import type { graphlib } from 'dagre';
import type { FlowNode, Item } from './types';

/** Override automatic ranks with production stages; an empty map retains Dagre's cycle layout. */
export function buildProductionStageLayout(
    graph: graphlib.Graph,
    flowNodes: FlowNode[],
    items: Item[],
    targetItemIds: string[],
): Map<number, { x: number; y: number }> {
    // Assign production stages, advancing consumers when a recipe needs another
    // item in the same category. Keep Dagre's vertical ordering within stages.
    const targets = new Set(targetItemIds);
    const itemTypes = new Map(items.map(item => [item.id, item.type]));
    const stages: number[] = flowNodes.map(node => itemTypes.get(node.outputItem) === 'raw' ? 0
        : itemTypes.get(node.outputItem) === 'processed' ? 1 : 2);
    const pendingInputs = flowNodes.map((_, index) => graph.inEdges(`node_${index}`)?.length ?? 0);
    const ready = pendingInputs.flatMap((count, index) => count === 0 ? [index] : []);
    let visited = 0;
    for (let cursor = 0; cursor < ready.length; cursor++) {
        const source = ready[cursor];
        visited++;
        for (const edge of graph.outEdges(`node_${source}`) ?? []) {
            const destination = Number(edge.w.slice(5));
            stages[destination] = Math.max(stages[destination], stages[source] + 1);
            if (--pendingInputs[destination] === 0) ready.push(destination);
        }
    }

    const positions = new Map<number, { x: number; y: number }>();
    // Retain the existing layout for cyclic graphs instead of inventing an order.
    if (visited === flowNodes.length) {
        const isTarget = (index: number) => flowNodes[index].nodeType === 'production'
            && targets.has(flowNodes[index].outputItem);
        const targetStage = Math.max(1, ...stages.filter((_, index) =>
            !isTarget(index) && flowNodes[index].nodeType !== 'launcher')) + 1;
        flowNodes.forEach((node, index) => {
            if (isTarget(index)) stages[index] = targetStage;
            if (node.nodeType === 'launcher') stages[index] = targetStage + 1;
        });
        const grouped = new Map<number, number[]>();
        stages.forEach((stage, index) => {
            const indices = grouped.get(stage) ?? [];
            indices.push(index);
            grouped.set(stage, indices);
        });
        const maxRows = Math.max(0, ...[...grouped.values()].map(indices => indices.length));
        for (const [stage, indices] of grouped) {
            indices.sort((a, b) => graph.node(`node_${a}`).y - graph.node(`node_${b}`).y || a - b);
            indices.forEach((index, row) => positions.set(index, {
                x: stage * 340,
                y: ((maxRows - indices.length) / 2 + row) * 240,
            }));
        }
    }

    return positions;
}
