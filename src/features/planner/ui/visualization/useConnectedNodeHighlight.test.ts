import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { useConnectedNodeHighlight } from './useConnectedNodeHighlight';

const nodes: Node[] = ['a', 'b', 'c'].map((id) => ({
    id, position: { x: 0, y: 0 }, data: {},
}));
const edges: Edge[] = [{ id: 'ab', source: 'a', target: 'b' }];

describe('pinned connection highlighting', () => {
    it('locks the pinned node, keeps focus through other drags, and restores on unpin', () => {
        const { result } = renderHook(() => useConnectedNodeHighlight(nodes, edges));
        act(() => result.current.toggleNodePin('a'));
        expect(result.current.nodes[0].draggable).toBe(false);
        expect(result.current.nodes[1].style?.opacity).toBe(1);
        expect(result.current.nodes[2].style?.opacity).toBeLessThan(0.5);
        expect(result.current.edges[0].labelStyle?.outline).toBeDefined();

        act(() => result.current.onNodeDragStart(new MouseEvent('mousedown'), nodes[2], nodes));
        act(() => result.current.onNodeDragStop(new MouseEvent('mouseup'), nodes[2], nodes));
        expect(result.current.pinnedNodeId).toBe('a');
        expect(result.current.nodes[0].draggable).toBe(false);
        expect(result.current.edges[0].labelStyle?.outline).toBeDefined();

        act(() => result.current.toggleNodePin('a'));
        expect(result.current.nodes).toBe(nodes);
        expect(result.current.edges).toBe(edges);
    });

    it('switches the lock when a different node is pinned', () => {
        const { result } = renderHook(() => useConnectedNodeHighlight(nodes, edges));
        act(() => result.current.toggleNodePin('a'));
        act(() => result.current.toggleNodePin('c'));
        expect(result.current.nodes[0].draggable).toBeUndefined();
        expect(result.current.nodes[2].draggable).toBe(false);
        expect(result.current.edges[0].labelStyle?.outline).toBeUndefined();
    });
});
