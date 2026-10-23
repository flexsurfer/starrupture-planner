// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, extractionFixture, saveFixture, saveLookups } from './decoder/test-fixture';
import { buildSaveMap } from './map';
import { buildSaveOverview } from './overview';
import { createSaveWorkspace } from './workspace';

function overlappingWorkspace() {
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    snapshot.cores[1].bounds!.min.x = -5;
    snapshot.cores[0].buildings.push(
        { id: 90, name: null, position: { x: 5, y: 0, z: 0 }, buildingTypeId: 'base_core_amplifier_v1', powerNetworkId: null, configuration: { kind: 'other' } },
        { id: 91, name: null, position: { x: 5, y: 0, z: 0 }, buildingTypeId: 'base_core_amplifier_v2', powerNetworkId: null, configuration: { kind: 'other' } },
    );
    return createSaveWorkspace('one', 'World', snapshot);
}

it('lists covered machines and amplifiers in every Core while keeping map entities and network power unique', () => {
    const workspace = overlappingWorkspace();
    const original = JSON.stringify(workspace);
    const overview = buildSaveOverview(workspace, saveLookups);
    expect(overview.cores.map(core => [core.heat, core.heatCapacity])).toEqual([[3, 1270], [8, 6270]]);
    expect(overview.cores.map(core => core.buildings.map(building => building.id))).toEqual([[10, 90, 91], [10, 90, 91, 11]]);
    expect(overview.cores.map(core => core.buildingSections.production.find(entry => entry.detail.building.id === 'smelter')))
        .toEqual([expect.objectContaining({ count: 1, sharedCount: 1 }), expect.objectContaining({ count: 1, sharedCount: 1 })]);
    expect(overview.powerNetworks.find(network => network.id === 9)).toMatchObject({ buildingCount: 2, powerUse: 15 });
    expect(overview.powerNetworks.find(network => network.id === 9)?.coreContributions)
        .toMatchObject([{ coreId: 1, buildingCount: 1, sharedCount: 1 }, { coreId: 2, buildingCount: 2, sharedCount: 1 }]);
    expect(buildSaveMap(overview, saveLookups).entities.map(entity => entity.id).sort((a, b) => a - b)).toEqual([1, 2, 10, 11, 90, 91]);
    expect(JSON.stringify(workspace)).toBe(original);
});

it('supports three covering Cores without propagating heat or bonuses through an overlap chain', () => {
    const workspace = overlappingWorkspace();
    const template = workspace.snapshot.cores[0];
    workspace.snapshot.cores.push(
        { ...template, id: 3, position: { x: 5, y: 0, z: 0 }, buildings: [],
            bounds: { min: { x: -5, y: -10, z: -10 }, max: { x: 15, y: 10, z: 10 } } },
        { ...template, id: 4, position: { x: 45, y: 0, z: 0 }, buildings: [],
            bounds: { min: { x: 35, y: -10, z: -10 }, max: { x: 55, y: 10, z: 10 } } },
    );
    const overview = buildSaveOverview(workspace, saveLookups);
    expect(overview.cores.map(core => [core.heat, core.heatCapacity])).toEqual([[3, 1270], [8, 6270], [3, 1270], [0, 1000]]);
});

it('shows the full output of shared extractors in each covering Core and retains unique source IDs', () => {
    const snapshot = analyzeSave(extractionFixture(), extractionContext);
    snapshot.cores[1].bounds!.min.x = -5;
    const overview = buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups);
    const resources = overview.cores.map(core => core.incoming.find(resource => resource.itemId === 'ore_titanium')!);
    expect(resources.map(resource => resource.rate)).toEqual([420, 1380]);
    expect(resources.map(resource => resource.buildings.filter(building => building.cores.length > 1).map(building => building.buildingId)))
        .toEqual([[100, 101, 102], [100, 101, 102]]);
    expect(resources[1].buildings.find(building => building.buildingId === 103)?.cores.map(core => core.id)).toEqual([2]);
    expect(overview.buildingDetails.filter(detail => detail.instance.configuration.kind === 'extractor')).toHaveLength(7);
});

it.each(['x', 'y', 'z'] as const)('includes the exact %s boundaries and excludes heat and bonuses beyond them', axis => {
    for (const coordinate of [-10, 10, -10.001, 10.001]) {
        const workspace = overlappingWorkspace();
        for (const building of workspace.snapshot.cores[0].buildings) building.position[axis] = coordinate;
        const core = buildSaveOverview(workspace, saveLookups).cores[0];
        expect([core.heat, core.heatCapacity]).toEqual(Math.abs(coordinate) === 10 ? [3, 1270] : [0, 1000]);
    }
});

it('uses coverage even when the assigned Core does not contain a building', () => {
    const workspace = overlappingWorkspace();
    for (const building of workspace.snapshot.cores[0].buildings) building.position.x = 30;
    const overview = buildSaveOverview(workspace, saveLookups);
    expect(overview.cores.map(core => [core.heat, core.heatCapacity])).toEqual([[0, 1000], [8, 6270]]);
});

it('retains the nearest-Core estimate for missing bounds while other Cores still use coverage', () => {
    const workspace = overlappingWorkspace();
    workspace.snapshot.cores[0].bounds = null;
    for (const building of workspace.snapshot.cores[0].buildings) building.position.x = 30;
    expect(buildSaveOverview(workspace, saveLookups).cores.map(core => [core.heat, core.heatCapacity]))
        .toEqual([[3, 1270], [8, 6270]]);
    workspace.snapshot.cores[1].bounds = null;
    expect(buildSaveOverview(workspace, saveLookups).cores.map(core => [core.heat, core.heatCapacity]))
        .toEqual([[3, 1270], [5, 6000]]);
});

it('keeps totals unknown in every covering Core when a contributing building is absent from the catalogue', () => {
    const buildings = new Map(saveLookups.buildings);
    buildings.delete('base_core_amplifier_v1');
    const overview = buildSaveOverview(overlappingWorkspace(), { ...saveLookups, buildings });
    expect(overview.cores.map(core => [core.heat, core.heatCapacity])).toEqual([[null, null], [null, null]]);
});
