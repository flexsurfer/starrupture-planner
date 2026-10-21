// @vitest-environment node
import { expect, it } from 'vitest';
import { buildBuildingStacks, buildingsStack } from './building-stacks';
import type { SaveBuilding } from './snapshot';
import { analyzeSave } from './decoder/analyze';
import { extractionContext } from './decoder/test-fixture';
import { factoryMapOverlapFixture } from '../../../test/fixtures/factory-map-overlaps';

const building = (id: number, x = 0, y = 0, z = 0): SaveBuilding => ({
    id, position: { x, y, z }, buildingTypeId: 'fabricator', name: null,
    powerNetworkId: null, configuration: { kind: 'other' },
});

it('rejects same-Z buildings including numerical noise, even when nodes coincide', () => {
    const a = building(1);
    expect(buildingsStack(a, building(2))).toBe(false);
    expect(buildingsStack(a, building(2, 0, 0, .00005))).toBe(false);
    expect(buildingsStack(a, building(2, 0, 0, 1000))).toBe(true);
});

it.each([[56, 448], [72, 576], [88, 704]])('uses an 80% overlap square for node size %s, excluding fringe and touching edges', (size, extent) => {
    const a = building(1, 0, 0, -1000), b = building(2, extent - 1, extent - 1, 2700);
    expect(buildingsStack(a, b, size)).toBe(true);
    expect(buildingsStack(b, a, size)).toBe(true);
    for (const [x, y] of [[extent, 0], [0, extent], [extent, extent], [extent + 1, 0], [-extent, 0], [0, -extent], [size * 10 - 1, 0]]) {
        expect(buildingsStack(a, building(3, x, y, 1000), size)).toBe(false);
    }
});

it('uses node size without requiring matching building types', () => {
    const a = building(1), b = building(2, 500, 0, 1800);
    b.buildingTypeId = 'smelter';
    expect(buildingsStack(a, b, 56)).toBe(false);
    expect(buildingsStack(a, b, 72)).toBe(true);
    expect(buildingsStack(a, b, 88)).toBe(true);
    const further = building(3, 640, 0, 3600);
    expect(buildingsStack(a, further, 72)).toBe(false);
    expect(buildingsStack(a, further, 88)).toBe(true);
});

it('keeps above/below relations direct, ordered by saved Z, independent of record order', () => {
    const a = building(1), b = building(2, 500, 0, 1800), c = building(3, 1000, 0, 4000);
    const stacks = buildBuildingStacks([c, a, b]);
    expect(stacks.get(1)).toEqual({ above: [2], below: [] });
    expect(stacks.get(2)).toEqual({ above: [3], below: [1] });
    expect(stacks.get(3)).toEqual({ above: [], below: [2] });
    expect(buildBuildingStacks([a, b, c])).toEqual(stacks);
});

it('matches brute-force node intersections across grid edges, negative and extreme coordinates', () => {
    const buildings = Array.from({ length: 90 }, (_, i) =>
        building(i + 1, (i % 11) * 390 - 2500, (i % 7) * 300 - 1000, (i % 4) * 123.5));
    buildings.push(building(101, 999.99998, -1000), building(102, 1000, -1000, 1000));
    buildings.push(building(103, 1e20, 1e20), building(104, 1e20, 1e20, 1000));
    for (const [size, extent] of [[56, 448], [72, 576], [88, 704]]) {
        const stacks = buildBuildingStacks(buildings, size);
        for (const a of buildings) {
            const expected = buildings.filter(b => Math.abs(a.position.z - b.position.z) > .0001
                && Math.abs(a.position.x - b.position.x) < extent - .0001
                && Math.abs(a.position.y - b.position.y) < extent - .0001).map(b => b.id).sort((a, b) => a - b);
            expect([...stacks.get(a.id)!.above, ...stacks.get(a.id)!.below].sort((a, b) => a - b)).toEqual(expected);
        }
    }
});

it('decodes offset mixed models and different poses into layers while excluding equal Z', () => {
    const buildings = analyzeSave(factoryMapOverlapFixture(), extractionContext).cores.flatMap(c => c.buildings);
    const stacks = buildBuildingStacks(buildings);
    for (const id of [101, 102, 103, 104]) expect(stacks.get(id)).toEqual({ above: [id + 4], below: [] });
    for (const id of [301, 302, 303, 304, 305, 306, 307, 308, 601, 602, 803, 804]) {
        expect(stacks.get(id)).toEqual({ above: [], below: [] });
    }
    expect(stacks.get(201)).toEqual({ above: [202], below: [203] });
    expect(stacks.get(202)).toEqual({ above: [], below: [201, 203] });
    expect(stacks.get(203)).toEqual({ above: [201, 202], below: [] });
    expect(stacks.get(401)).toEqual({ above: [402, 403], below: [] });
    expect(stacks.get(505)).toEqual({ above: [506, 507, 508, 509, 510], below: [504, 503, 502, 501] });
    expect(stacks.get(701)).toEqual({ above: [702], below: [] });
    expect(stacks.get(703)).toEqual({ above: [704], below: [] });
    expect(stacks.get(801)).toEqual({ above: [802], below: [] });
    const large = buildBuildingStacks(buildings, 88);
    expect(large.get(801)).toEqual({ above: [802, 803], below: [] });
    expect(large.get(803)).toEqual({ above: [804], below: [801] });
    expect(large.get(804)).toEqual({ above: [], below: [803] });
});
