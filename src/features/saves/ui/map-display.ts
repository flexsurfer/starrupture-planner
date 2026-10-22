import type { SavePosition } from '../snapshot';
import { coreMarkerSize } from '../map-coordinates';
import { getSmoothStepPath, Position } from '@xyflow/react';

export { defaultMapDisplay, type MapDisplaySettings } from '../map-preferences';

export interface CoreLabelPeer {
    id: number;
    x: number;
    y: number;
    name: string;
}

/** Keep names beside their Core; crowded labels are revealed on hover or selection. */
export function placeCoreLabels(peers: readonly CoreLabelPeer[], zoom: number) {
    type Rect = { x: number; y: number; width: number; height: number };
    const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width + 2 && a.x + a.width + 2 > b.x
        && a.y < b.y + b.height + 2 && a.y + a.height + 2 > b.y;
    const diameter = coreMarkerSize(zoom) * zoom;
    const markers = peers.map(peer => ({ x: peer.x * zoom - diameter / 2, y: peer.y * zoom - diameter / 2, width: diameter, height: diameter }));
    const placed: Rect[] = [];
    const positions = new Map<number, { x: number; y: number }>();
    for (const peer of peers) {
        const width = Math.min(100, 6 + peer.name.length * 5.5);
        const height = 16;
        const vertical = diameter / 2 + 3 + height / 2, horizontal = diameter / 2 + 3 + width / 2;
        const candidates = [{ x: 0, y: vertical }, { x: 0, y: -vertical }, { x: horizontal, y: 0 }, { x: -horizontal, y: 0 }];
        for (const position of candidates) {
            const rect = { x: peer.x * zoom + position.x - width / 2, y: peer.y * zoom + position.y - height / 2, width, height };
            if (placed.some(other => overlaps(rect, other)) || markers.some(marker => overlaps(rect, marker))) continue;
            positions.set(peer.id, position);
            placed.push(rect);
            break;
        }
    }
    return positions;
}

/** Face the peer along the dominant axis, avoiding the loops caused by fixed left/right ports. */
export function cargoHandles(source: SavePosition, target: SavePosition) {
    const dx = target.x - source.x, dy = target.y - source.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return horizontal
        ? { sourceHandle: dx >= 0 ? 'source-right' : 'source-left', targetHandle: dx >= 0 ? 'target-left' : 'target-right' }
        : { sourceHandle: dy >= 0 ? 'source-bottom' : 'source-top', targetHandle: dy >= 0 ? 'target-top' : 'target-bottom' };
}

/** Use the building route style with screen-sized Core endpoints and separate directions. */
export function coreCargoPath(source: Pick<SavePosition, 'x' | 'y'>, target: Pick<SavePosition, 'x' | 'y'>,
    zoom: number, bidirectional: boolean): [string, number, number] | null {
    const dx = target.x - source.x, dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    const radius = coreMarkerSize(zoom) / 2 + 3 / zoom;
    if (distance <= radius * 2) return null;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const direction = Math.sign(horizontal ? dx : dy);
    const lane = bidirectional ? 3 / zoom : 0;
    const inset = Math.sqrt(radius * radius - lane * lane);
    const offsetX = horizontal ? 0 : -direction * lane, offsetY = horizontal ? direction * lane : 0;
    const [path, labelX, labelY] = getSmoothStepPath({
        sourceX: source.x + offsetX + (horizontal ? direction * inset : 0),
        sourceY: source.y + offsetY + (horizontal ? 0 : direction * inset),
        targetX: target.x + offsetX - (horizontal ? direction * inset : 0),
        targetY: target.y + offsetY - (horizontal ? 0 : direction * inset),
        sourcePosition: horizontal ? (dx > 0 ? Position.Right : Position.Left) : (dy > 0 ? Position.Bottom : Position.Top),
        targetPosition: horizontal ? (dx > 0 ? Position.Left : Position.Right) : (dy > 0 ? Position.Top : Position.Bottom),
        borderRadius: 4 / zoom, offset: 8 / zoom,
    });
    return [path, labelX, labelY];
}
