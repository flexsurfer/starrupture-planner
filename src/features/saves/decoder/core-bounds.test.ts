// @vitest-environment node
import { expect, it } from 'vitest';
import { readCoreBounds } from './core-bounds';
import { analyzeSave } from './analyze';
import { extractionContext, saveFixture } from './test-fixture';

const box = '(Min=(X=-10000.250000,Y=-2e4,Z=-30),Max=(X=1e4,Y=20000.5,Z=+40),IsValid=True)';
const fragment = (bounds: string) => `/Script/Chimera.CrMassBuildingBaseCoreFragment(InfectedBaseCoreLocalSpawners=((SpawnerLocation=(X=1,Y=2,Z=3))),CachedBoundingBox=${bounds})`;

it('reads exact XYZ bounds alongside nested Core data without changing building ownership', () => {
    const save = saveFixture();
    save.itemData.Mass.entities['(ID=1)'].fragmentValues[1] = fragment(box);
    const snapshot = analyzeSave(save, extractionContext);
    expect(snapshot.cores[0].bounds).toEqual({ min: { x: -10000.25, y: -20000, z: -30 }, max: { x: 10000, y: 20000.5, z: 40 } });
    // Both buildings lie inside these bounds; the second still belongs to its nearest Core.
    expect(snapshot.cores.map(core => core.buildings.map(building => building.id))).toEqual([[10], [11]]);
});

it.each([
    box.replace('IsValid=True', 'IsValid=False'),
    box.replace(',IsValid=True', ''),
    box.replace('Y=-2e4,', ''),
    box.replace('X=-10000.250000', 'X=NaN'),
    box.replace('X=-10000.250000', 'X=-Infinity'),
    box.replace('X=-10000.250000', 'X=-1e309'),
    box.replace('X=-10000.250000', 'X='),
    box.replace('X=-10000.250000', 'X=0x10'),
    box.replace('Y=-2e4', 'Y=30000'),
    box.replace('Z=-30', 'Z=+40'),
    box.replace('X=-10000.250000', 'X=-1e308').replace('X=1e4', 'X=1e308'),
    box.replace('X=-10000.250000', 'X=-10000,X=-10000'),
    box.replace(',IsValid=True', ',IsValid=True,IsValid=True'),
    box.slice(0, -1),
])('omits invalid optional bounds without rejecting the save: %s', bounds => {
    const save = saveFixture();
    save.itemData.Mass.entities['(ID=1)'].fragmentValues[1] = fragment(bounds);
    expect(analyzeSave(save, extractionContext).cores[0].bounds).toBeNull();
});

it('leaves missing or ambiguous Core bounds unknown', () => {
    expect(readCoreBounds([])).toBeNull();
    expect(readCoreBounds([fragment(box), fragment(box)])).toBeNull();
    expect(readCoreBounds([fragment(box).replace(`CachedBoundingBox=${box}`, `CachedBoundingBox=${box},CachedBoundingBox=${box}`)])).toBeNull();
});
