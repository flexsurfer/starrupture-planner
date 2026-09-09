import { describe, expect, it } from 'vitest';
import { buildMultiTargetProductionFlow, buildProductionFlow } from './production-flow';
import { buildPlannerFlowGraph } from './flow-graph';
import type { Building, Item } from './types';

const items: Item[] = [
    { id: 'ore', name: 'Ore', type: 'raw' },
    { id: 'water', name: 'Water', type: 'raw' },
    { id: 'plate', name: 'Plate', type: 'processed' },
    { id: 'wire', name: 'Wire', type: 'processed' },
    { id: 'part', name: 'Part', type: 'component' },
    { id: 'assembly', name: 'Assembly', type: 'component' },
    { id: 'short', name: 'Short', type: 'component' },
    { id: 'long', name: 'Long', type: 'component' },
];
const buildings: Building[] = [{
    id: 'factory', name: 'Factory',
    recipes: [
        ['ore', []], ['water', []],
        ['plate', ['ore']], ['wire', ['ore']],
        ['part', ['plate']], ['assembly', ['part']],
        ['short', ['wire']], ['long', ['assembly', 'water']],
    ].map(([id, inputs]) => ({
        output: { id: id as string, amount_per_minute: 60 },
        inputs: (inputs as string[]).map(id => ({ id, amount_per_minute: 60 })),
    })),
}, {
    id: 'orbital_cargo_launcher', name: 'Launcher', recipes: [],
}];

describe('planner production stage layout', () => {
    it('aligns raw materials, processed items, and targets despite different chain lengths', () => {
        const flow = buildMultiTargetProductionFlow([{ itemId: 'short', amount: 60 }, { itemId: 'long', amount: 60 }], buildings);
        const graph = buildPlannerFlowGraph(flow.nodes, flow.edges, items, ['short', 'long'], 'LR', true);
        const positions = Object.fromEntries(graph.nodes.map(node => [node.flowNode.outputItem, node.position]));
        expect(positions.ore.x).toBe(positions.water.x);
        expect(positions.plate.x).toBe(positions.wire.x);
        expect(positions.short.x).toBe(positions.long.x);
        expect(positions.part.x).toBeGreaterThan(positions.plate.x);
        expect(positions.assembly.x).toBeGreaterThan(positions.part.x);
        expect(positions.long.x).toBeGreaterThan(positions.assembly.x);
        expect(Math.abs(positions.short.y - positions.long.y)).toBeGreaterThanOrEqual(210);
        for (const edge of graph.edges) {
            const source = graph.nodes.find(node => node.id === edge.source)!;
            const target = graph.nodes.find(node => node.id === edge.target)!;
            expect(source.position.x).toBeLessThan(target.position.x);
        }
        expect(graph.edges).toHaveLength(flow.edges.length);
        expect(graph.nodes.map(node => node.flowNode)).toEqual(flow.nodes);
    });

    it.each([
        ['LR', 'x', 1, 'right', 'left'],
        ['RL', 'x', -1, 'left', 'right'],
        ['TB', 'y', 1, 'bottom', 'top'],
        ['BT', 'y', -1, 'top', 'bottom'],
    ] as const)('orients stages and connection handles for %s', (direction, axis, sign, sourceHandle, targetHandle) => {
        const flow = buildMultiTargetProductionFlow([{ itemId: 'short', amount: 60 }, { itemId: 'long', amount: 60 }], buildings);
        const graph = buildPlannerFlowGraph(flow.nodes, flow.edges, items, ['short', 'long'], direction, true);
        const targetNodes = graph.nodes.filter(node => ['short', 'long'].includes(node.flowNode.outputItem));
        expect(targetNodes[0].position[axis]).toBe(targetNodes[1].position[axis]);
        expect(graph.nodes.map(node => node.flowNode)).toEqual(flow.nodes);
        for (const node of graph.nodes) {
            expect(node.sourcePosition).toBe(sourceHandle);
            expect(node.targetPosition).toBe(targetHandle);
        }
        for (const edge of graph.edges) {
            const source = graph.nodes.find(node => node.id === edge.source)!;
            const target = graph.nodes.find(node => node.id === edge.target)!;
            expect((target.position[axis] - source.position[axis]) * sign).toBeGreaterThan(0);
        }
    });

    it.each(['LR', 'RL', 'TB', 'BT'] as const)('can use automatic layout in %s without changing production', direction => {
        const flow = buildMultiTargetProductionFlow([{ itemId: 'short', amount: 60 }, { itemId: 'long', amount: 60 }], buildings);
        const grouped = buildPlannerFlowGraph(flow.nodes, flow.edges, items, ['short', 'long'], direction, true);
        const automatic = buildPlannerFlowGraph(flow.nodes, flow.edges, items, ['short', 'long'], direction, false);
        expect(automatic.nodes.map(node => node.position)).not.toEqual(grouped.nodes.map(node => node.position));
        expect(automatic.nodes.map(node => node.flowNode)).toEqual(flow.nodes);
        expect(automatic.edges).toEqual(grouped.edges);
        const axis = direction === 'LR' || direction === 'RL' ? 'x' : 'y';
        const sign = direction === 'RL' || direction === 'BT' ? -1 : 1;
        for (const edge of automatic.edges) {
            const source = automatic.nodes.find(node => node.id === edge.source)!;
            const target = automatic.nodes.find(node => node.id === edge.target)!;
            expect((target.position[axis] - source.position[axis]) * sign).toBeGreaterThan(0);
        }
    });

    it('places delivery after the single target and supports empty flows', () => {
        const flow = buildProductionFlow({ targetItemId: 'long', includeLauncher: true }, buildings);
        const graph = buildPlannerFlowGraph(flow.nodes, flow.edges, items, ['long'], 'LR', true);
        const target = graph.nodes.find(node => node.flowNode.nodeType === 'production' && node.flowNode.outputItem === 'long')!;
        const launcher = graph.nodes.find(node => node.flowNode.nodeType === 'launcher')!;
        expect(launcher.position.x).toBeGreaterThan(target.position.x);
        expect(buildPlannerFlowGraph([], [], [], []).nodes).toEqual([]);
    });
});
