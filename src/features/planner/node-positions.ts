export type PlannerNodePositions = Record<string, { x: number; y: number }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Old plans have no overrides. Archives reject invalid entries, while local saves recover valid ones. */
export function normalizeNodePositions(value: unknown, strict = false): PlannerNodePositions {
    const positions: PlannerNodePositions = {};
    if (value === undefined) return positions;
    if (!isRecord(value)) {
        if (strict) throw new Error('Invalid node positions');
        return positions;
    }
    for (const [id, point] of Object.entries(value)) {
        if (!id.trim() || id in Object.prototype || id === 'prototype' || !isRecord(point)
            || typeof point.x !== 'number' || !Number.isFinite(point.x)
            || typeof point.y !== 'number' || !Number.isFinite(point.y)) {
            if (strict) throw new Error('Invalid node position');
            continue;
        }
        positions[id] = { x: point.x, y: point.y };
    }
    return positions;
}
