// @vitest-environment node
import { expect, it } from 'vitest';
import observed from './fixtures/observed-0.3.5.json';
import { analyzeSave } from './analyze';
import { coreEntity, extractionContext, saveFixture, snapshotFixture } from './test-fixture';

it('assigns every supported building to the nearest Core, including outside all bounds', () => {
    const save = saveFixture();
    save.itemData.Mass.entities['(ID=2)'] = coreEntity(5);
    const snapshot = analyzeSave(save, extractionContext);
    expect(snapshot.cores.map(core => [core.id, core.buildings.map(building => building.id)])).toEqual([[1, [10]], [2, [11]]]);
    expect(snapshot.gameData.revision).toBe(extractionContext.mappings.mappingRevision);
    expect(snapshot.cores[0]).toMatchObject({ id: 1, name: 'Workshop', spawnTimeSeconds: 10.5, level: 0, powerNetworkId: 7 });
    expect(snapshot.cores[1].level).toBe(3);
    expect(snapshot.cores[0].buildings[0]).toMatchObject({ powerNetworkId: 9 });
    expect(snapshot.cores[0].bounds).toEqual({ min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } });
    expect(Object.keys(snapshot.cores[0]).sort()).toEqual(['bounds', 'buildings', 'id', 'level', 'name', 'position', 'powerNetworkId', 'spawnTimeSeconds']);
    expect(Object.keys(snapshot.cores[0].buildings[0]).sort()).toEqual(['buildingTypeId', 'configuration', 'id', 'name', 'position', 'powerNetworkId']);
});
it.each([undefined, null, -1, 1.5, '3', NaN, 4294967295])('leaves an unreadable Core upgrade level unknown: %s', level => {
    const save = saveFixture();
    const snapshot = analyzeSave({ ...save, itemData: { ...save.itemData, BaseCoreReplicationHelperSaveData: {
        baseCoreSaveData: [{ baseCore: { iD: 1 }, upgradeLevel: level }],
    } } }, extractionContext);
    expect(snapshot.cores.map(core => core.level)).toEqual([null, null]);
});
it('does not guess a Core level when its replication data is missing or contradictory', () => {
    const save = saveFixture();
    expect(analyzeSave({ ...save, itemData: { ...save.itemData, BaseCoreReplicationHelperSaveData: undefined } }, extractionContext)
        .cores.map(core => core.level)).toEqual([null, null]);
    save.itemData.BaseCoreReplicationHelperSaveData.baseCoreSaveData.push(
        { baseCore: { iD: 1 }, upgradeLevel: 2 }, { baseCore: { iD: 1 }, upgradeLevel: 0 },
    );
    expect(analyzeSave(save, extractionContext).cores.map(core => core.level)).toEqual([null, 3]);
});
it('breaks equal-distance ties by Core ID independently of serialized order', () => {
    const save = saveFixture();
    save.itemData.Mass.entities['(ID=10)'].spawnData.transform.translation.x = 15;
    save.itemData.Mass.entities = Object.fromEntries(Object.entries(save.itemData.Mass.entities).reverse()) as typeof save.itemData.Mass.entities;
    const snapshot = analyzeSave(save, extractionContext);
    expect(snapshot.cores.find(core => core.id === 1)?.buildings.map(building => building.id)).toContain(10);
});
it.each([{ fragments: [] }, { fragments: ['/Script/AuActorPlacement.AuAPMassFragment(SpawnServerTimeSeconds=NaN)'] },
    { fragments: ['/Script/AuActorPlacement.AuAPMassFragment(SpawnServerTimeSeconds=1)', '/Script/AuActorPlacement.AuAPMassFragment(SpawnServerTimeSeconds=2)'] }])('fails when a Core identity cannot be read: $fragments', ({ fragments }) => {
    const save = saveFixture();
    save.itemData.Mass.entities['(ID=1)'].fragmentValues = fragments;
    expect(() => analyzeSave(save, extractionContext)).toThrow('core-identity');
});
it('fails on an unreadable Core ID, missing positions, or buildings without Cores', () => {
    const save = saveFixture();
    const entities = { ...save.itemData.Mass.entities, bad: coreEntity(0) };
    expect(() => analyzeSave({ itemData: { Mass: { entities } } }, extractionContext)).toThrow('core-identity');
    save.itemData.Mass.entities['(ID=10)'].spawnData.transform.translation.x = NaN;
    expect(() => analyzeSave(save, extractionContext)).toThrow('position');
    expect(() => analyzeSave({ itemData: { Mass: { entities: { '(ID=10)': saveFixture().itemData.Mass.entities['(ID=10)'] } } } }, extractionContext)).toThrow('position');
});
it('requires identity even in the old sanitized fixture that omitted placement fields', () => {
    expect(() => analyzeSave(observed, extractionContext)).toThrow('core-identity');
});
it('keeps exact production selections but discards running state and unknown recipes', () => {
    const buildings = analyzeSave(snapshotFixture(), extractionContext).cores.flatMap(core => core.buildings);
    expect(buildings.find(building => building.id === 200)?.configuration).toEqual({ kind: 'production', recipeId: 'fabricator:9' });
    expect(buildings.find(building => building.id === 201)?.configuration).toEqual({ kind: 'production', recipeId: 'craftertier2:5' });
    expect(buildings.find(building => building.id === 202)?.configuration).toEqual({ kind: 'production', recipeId: 'craftertier2:tube_v2' });
    for (const id of [203, 204, 205, 206]) expect(buildings.find(building => building.id === id)?.configuration).toEqual({ kind: 'production', recipeId: null });
    expect(JSON.stringify(buildings)).not.toMatch(/Disabled|disabled|CraftingSpeed|\/Game\/|\/Script\/|source/);
});
it('preserves individual network IDs and leaves conflicting evidence unknown', () => {
    const save = saveFixture();
    Object.assign(save.itemData.Mass.electricitySubsystemState.nodeData, {
        duplicate: { handle: { iD: 10 }, subGraph: { subGraphId: 12 } },
        invalid: { handle: { iD: 11 }, subGraph: { subGraphId: 4294967295 } },
    });
    expect(analyzeSave(save, extractionContext).cores.flatMap(core => core.buildings).map(building => building.powerNetworkId)).toEqual([null, null]);
});

it('retains detached XYZ positions for Cores and buildings, including negative and elevated coordinates', () => {
    const save = saveFixture();
    const point = { x: -125.75, y: 99.25, z: 800.5 };
    save.itemData.Mass.entities['(ID=10)'].spawnData.transform.translation = point;
    const snapshot = analyzeSave(save, extractionContext);
    const building = snapshot.cores.flatMap(core => core.buildings).find(building => building.id === 10)!;
    expect(building.position).toEqual(point);
    expect(snapshot.cores[1].position).toEqual({ x: 30, y: 0, z: 0 });
    point.x = 1000;
    expect(building.position.x).toBe(-125.75);
});
