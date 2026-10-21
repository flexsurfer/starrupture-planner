import type { SavePosition } from '../snapshot';
import { coreMarkerSize } from '../map-coordinates';

export { defaultMapDisplay, type MapDisplaySettings } from '../map-preferences';

export interface CoreLabelPeer {
    id: number;
    x: number;
    y: number;
    name: string;
    countLabel: string;
}

/** Keep every Core label visible, choosing a free side of its marker at screen scale. */
export function placeCoreLabels(peers: readonly CoreLabelPeer[], zoom: number) {
    type Rect = { x: number; y: number; width: number; height: number };
    const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x
        && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;
    const diameter = coreMarkerSize(zoom) * zoom;
    const markers = peers.map(peer => ({ x: peer.x * zoom - diameter / 2, y: peer.y * zoom - diameter / 2, width: diameter, height: diameter }));
    const placed: Rect[] = [];
    const positions = new Map<number, { x: number; y: number }>();
    const textScale = Math.max(1, zoom);
    for (const peer of peers) {
        const width = (14 + Math.max(Math.min(156, peer.name.length * 6.5), zoom < 0.12 ? peer.countLabel.length * 5.5 : 0)) * textScale;
        const height = (zoom < 0.12 ? 39 : 24) * textScale;
        const vertical = diameter / 2 + 6 + height / 2, horizontal = diameter / 2 + 6 + width / 2;
        const candidates = [{ x: 0, y: vertical }, { x: 0, y: -vertical }, { x: horizontal, y: 0 }, { x: -horizontal, y: 0 }];
        for (let row = 1; row <= peers.length; row++) candidates.push({ x: 0, y: vertical + row * (height + 6) }, { x: 0, y: -vertical - row * (height + 6) });
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
