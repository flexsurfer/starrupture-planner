// @vitest-environment node
import { expect, it } from 'vitest';
import { coreCargoPath } from './map-display';

it('keeps Core arrow endpoints clear of their screen-sized icons across world zooms', () => {
    for (const zoom of [.005, .03, .11]) {
        const path = coreCargoPath({ x: 0, y: 0 }, { x: 10000, y: 0 }, zoom, false)!;
        const coordinates = path[0].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const [startX, startY] = coordinates;
        const [endX, endY] = coordinates.slice(-2);
        expect(startX * zoom).toBeCloseTo(15);
        expect((10000 - endX) * zoom).toBeCloseTo(15);
        expect(startY).toBe(0);
        expect(endY).toBe(0);
        expect(path[1]).toBeCloseTo(5000);
        expect(path[2]).toBe(0);
    }
});

it('separates opposite Core routes and omits paths between overlapping icons', () => {
    const source = { x: 0, y: 0 }, target = { x: 10000, y: 0 };
    const forward = coreCargoPath(source, target, .03, true)!;
    const backward = coreCargoPath(target, source, .03, true)!;
    expect(forward[2]).toBeGreaterThan(0);
    expect(backward[2]).toBeLessThan(0);
    expect(forward[2]).toBeCloseTo(-backward[2]);
    expect(coreCargoPath(source, source, .03, true)).toBeNull();
    expect(coreCargoPath(source, { x: 300, y: 100 }, .03, false)).toBeNull();
});
