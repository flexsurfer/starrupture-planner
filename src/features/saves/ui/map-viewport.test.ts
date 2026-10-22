import { expect, it } from 'vitest';
import { BUILDING_DETAIL_ZOOM, coreInViewport } from './map-viewport';

const marker = (coreId: number, x: number, y: number, isCore = false) => ({ coreId, x, y, isCore });

it('chooses the nearest visible marker even when its Core marker is off screen', () => {
    const markers = [marker(1, -100, 50, true), marker(1, 300, 50), marker(2, 600, 50)];
    expect(coreInViewport(markers, { x: -250, y: 0, zoom: 1 }, 100, 100, 72)).toBe(1);
    expect(coreInViewport(markers, { x: -500, y: 0, zoom: 1 }, 200, 100, 72)).toBe(2);
    // The same world centre after zooming has the same Core.
    expect(coreInViewport(markers, { x: -1100, y: -50, zoom: 2 }, 200, 100, 72)).toBe(2);
    expect(coreInViewport(markers, { x: -900, y: 0, zoom: 1 }, 100, 100, 72)).toBeNull();
    expect(coreInViewport([], { x: 0, y: 0, zoom: 1 }, 100, 100, 72)).toBeNull();
});

it('ignores empty gaps and does not let enclosing Core bounds steal focus from a visible marker', () => {
    const markers = [marker(1, -100, -100, true), marker(1, 200, 200)];
    const viewport = { x: 0, y: 0, zoom: 1 };
    // The Core's enclosing rectangle covers the entire viewport, but neither marker is visible.
    expect(coreInViewport(markers, viewport, 100, 100, 72)).toBeNull();
    markers.push(marker(2, 80, 80));
    expect(coreInViewport(markers, viewport, 100, 100, 72)).toBe(2);
});

it('includes partially visible markers using the current size and excludes mere edge contact', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };
    const markers = [marker(1, -40, 50)];
    expect(coreInViewport(markers, viewport, 100, 100, 56)).toBeNull();
    expect(coreInViewport(markers, viewport, 100, 100, 72)).toBeNull();
    expect(coreInViewport(markers, viewport, 100, 100, 88)).toBe(1);
    expect(coreInViewport([marker(1, -36, 50)], viewport, 100, 100, 72)).toBeNull();
    expect(coreInViewport([marker(1, -35, 50)], viewport, 100, 100, 72)).toBe(1);
    expect(coreInViewport([marker(1, 50, 136)], viewport, 100, 100, 72)).toBeNull();
});

it('uses the rendered Core marker size independently of building size', () => {
    const viewport = { x: 0, y: 0, zoom: .5 };
    // The compact Core is outside the viewport even though a building at the same position reaches it.
    expect(coreInViewport([marker(1, -20, 50, true)], viewport, 100, 100, 56)).toBeNull();
    expect(coreInViewport([marker(1, -20, 50)], viewport, 100, 100, 56)).toBe(1);
    expect(coreInViewport([marker(1, -17, 50, true)], viewport, 100, 100, 56)).toBe(1);
});

it('breaks equal-distance ties deterministically without depending on iteration order', () => {
    const markers = [marker(2, 75, 50), marker(1, 25, 50)];
    expect(coreInViewport(markers, { x: 0, y: 0, zoom: 1 }, 100, 100, 72)).toBe(1);
    expect(coreInViewport(markers.reverse(), { x: 0, y: 0, zoom: 1 }, 100, 100, 72)).toBe(1);
});

it('leaves world overview unfocused until building detail is visible', () => {
    const markers = [marker(1, 50, 50)];
    expect(coreInViewport(markers, { x: 0, y: 0, zoom: BUILDING_DETAIL_ZOOM - .001 }, 100, 100, 72)).toBeNull();
    expect(coreInViewport(markers, { x: 0, y: 0, zoom: BUILDING_DETAIL_ZOOM }, 100, 100, 72)).toBe(1);
    expect(coreInViewport(markers, { x: 0, y: 0, zoom: 1 }, 0, 100, 72)).toBeNull();
    expect(coreInViewport(markers, { x: 0, y: 0, zoom: 1 }, 100, 0, 72)).toBeNull();
});
