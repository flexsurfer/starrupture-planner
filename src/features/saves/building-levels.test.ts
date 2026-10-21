import { expect, it } from 'vitest';
import { buildBuildingLevels } from './building-levels';
import { buildBuildingStacks } from './building-stacks';
import type { SaveBuilding } from './snapshot';

const building = (id: number, x: number, z: number, y = 0): SaveBuilding => ({
    id, buildingTypeId: 'fabricator', name: null, powerNetworkId: null, configuration: { kind: 'other' }, position: { x, y, z },
});
const levelsOf = (buildings: SaveBuilding[]) => buildBuildingLevels(buildings, buildBuildingStacks(buildings));

it('keeps unrelated buildings on uneven ground at level 1, including negative and fractional Z', () => {
    const buildings = [90000, -1800, 123.25, 0, 0.00001, -1800, 3479.5].map((z, id) => building(id, id * 1000, z));
    expect([...levelsOf(buildings).values()]).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(levelsOf([])).toEqual(new Map());
});

it('numbers independent stacks from 1 regardless of their starting height or vertical spacing', () => {
    const buildings = [building(1, 0, -2000), building(2, 0, -100), building(3, 0, 30),
        building(4, 1000, 9000), building(5, 1000, 19000), building(6, 2000, 90000)];
    const levels = levelsOf(buildings);
    expect(buildings.map(b => levels.get(b.id))).toEqual([1, 2, 3, 1, 2, 1]);
    expect(levelsOf([...buildings].reverse())).toEqual(levels);
});

it('handles offset chains and bridges without counting unrelated lower elevations', () => {
    const buildings = [building(1, 0, 0), building(2, 500, 100), building(3, 1000, 200),
        building(4, 1576, 50), building(5, 1360, 300, 500)];
    const stacks = buildBuildingStacks(buildings);
    expect(stacks.get(3)?.below).toEqual([2]); // A→B→C, with no A↔C intersection.
    expect(stacks.get(4)?.below).toEqual([]); // Touching C's inset square doesn't count.
    const levels = buildBuildingLevels(buildings, stacks);
    expect(buildings.map(b => levels.get(b.id))).toEqual([1, 2, 3, 1, 4]);
});

it('skips coincident same-Z records and detects the upper node without geometry metadata', () => {
    const buildings = [building(1, 0, 0), building(2, 0, 0), building(3, 0, .00001), building(4, 0, 100)];
    expect(buildings.map(b => levelsOf(buildings).get(b.id))).toEqual([1, 1, 1, 2]);
});
