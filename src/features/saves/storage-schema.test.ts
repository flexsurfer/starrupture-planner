import { createSaveWorkspace } from './workspace';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveFixture } from './decoder/test-fixture';
// @vitest-environment node
import { expect, it } from 'vitest';
import { assertSaveStorageLimits, jsonBytes, localStorageBytes, MAX_SAVES_BYTES, MAX_WORKSPACE_BYTES, normalizeSaveWorkspace, normalizeSaveWorkspaces, saveCollectionStorageBytes, SaveWorkspaceLimitError } from './storage-schema';
import { workspaceAtStorageBytes } from './storage-test-fixture';

it('round-trips detached Core bounds and requires explicit nullable bounds', () => {
    const workspace = createSaveWorkspace('one', 'World', analyzeSave(saveFixture(), extractionContext));
    const normalized = normalizeSaveWorkspace(workspace);
    expect(normalized).toEqual(workspace);
    expect(normalized.snapshot.cores[0].bounds?.min).not.toBe(workspace.snapshot.cores[0].bounds?.min);
    workspace.snapshot.cores[0].bounds!.min.x = -100;
    expect(normalized.snapshot.cores[0].bounds?.min.x).toBe(-10);
    const legacy = JSON.parse(JSON.stringify(workspace));
    delete legacy.snapshot.cores[0].bounds;
    legacy.snapshot.cores[1].bounds = null;
    expect(() => normalizeSaveWorkspace(legacy)).toThrow();
});

it.each([
    {}, { min: { x: 0, y: 0, z: 0 } },
    { min: { x: -10, y: -10, z: -10 }, max: { x: Infinity, y: 10, z: 10 } },
    { min: { x: -10, y: -10, z: -10 }, max: { x: '10', y: 10, z: 10 } },
    { min: { x: 20, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } },
    { min: { x: -10, y: -10, z: 10 }, max: { x: 10, y: 10, z: 10 } },
    { min: { x: -1e308, y: -10, z: -10 }, max: { x: 1e308, y: 10, z: 10 } },
])('rejects corrupt stored Core bounds: %j', bounds => {
    const workspace = createSaveWorkspace('one', 'World', analyzeSave(saveFixture(), extractionContext));
    Object.assign(workspace.snapshot.cores[0], { bounds });
    expect(() => normalizeSaveWorkspace(workspace)).toThrow();
});

it('round-trips only finite XYZ coordinates and detaches them from imported data', () => {
    const workspace = createSaveWorkspace('one', 'World', analyzeSave(saveFixture(), extractionContext));
    workspace.snapshot.cores[0].position = { x: -123.75, y: 40.25, z: -5 };
    workspace.snapshot.cores[0].buildings[0].position = { x: -123.75, y: 40.25, z: 1500 };
    const normalized = normalizeSaveWorkspace(JSON.parse(JSON.stringify(workspace)));
    expect(normalized).toEqual(workspace);
    expect(normalized.snapshot.cores[0].position).not.toBe(workspace.snapshot.cores[0].position);
    for (const value of [undefined, null, { x: 1, y: 2 }, { x: Infinity, y: 0, z: 0 }, { x: 0, y: NaN, z: 0 }, { x: 0, y: 0, z: '1' }]) {
        const copy = structuredClone(workspace);
        Object.assign(copy.snapshot.cores[0], { position: value });
        expect(() => normalizeSaveWorkspace(copy)).toThrow();
        Object.assign(copy.snapshot.cores[0], { position: workspace.snapshot.cores[0].position });
        Object.assign(copy.snapshot.cores[0].buildings[0], { position: value });
        expect(() => normalizeSaveWorkspace(copy)).toThrow();
    }
});

it('counts UTF-16 code units for storage, including surrogate pairs, separately from UTF-8 JSON bytes', () => {
    expect(localStorageBytes('a')).toBe(6);
    expect(localStorageBytes('界')).toBe(6);
    expect(localStorageBytes('😀')).toBe(8);
    expect(jsonBytes('界')).toBe(5);
});

it('accepts a workspace at 1 MiB and rejects one extra code unit during import and hydration', () => {
    const workspace = workspaceAtStorageBytes(MAX_WORKSPACE_BYTES);
    expect(normalizeSaveWorkspace(workspace)).toEqual(workspace);
    expect(() => assertSaveStorageLimits({ one: workspace })).not.toThrow();
    workspace.snapshot.cores[0].buildings.at(-1)!.name += 'x';
    expect(() => normalizeSaveWorkspace(workspace)).toThrow(SaveWorkspaceLimitError);
    expect(() => normalizeSaveWorkspaces({ one: workspace })).toThrow(SaveWorkspaceLimitError);
});

it('rejects a collection above 3 MiB even when every workspace fits, including the Persist envelope', () => {
    const records = Object.fromEntries(['one', 'two', 'three', 'four'].map(id => [id, workspaceAtStorageBytes(MAX_SAVES_BYTES / 4, id)]));
    expect(Object.values(records).every(workspace => localStorageBytes(workspace) <= MAX_WORKSPACE_BYTES)).toBe(true);
    expect(saveCollectionStorageBytes(records)).toBeGreaterThan(MAX_SAVES_BYTES);
    expect(() => normalizeSaveWorkspaces(records)).toThrow(SaveWorkspaceLimitError);
    delete records.four;
    expect(() => normalizeSaveWorkspaces(records)).not.toThrow();
});

it('hydrates saved references before catalogs load and preserves a different valid import revision', () => {
    const workspace = createSaveWorkspace('one', 'World', analyzeSave(saveFixture(), extractionContext));
    workspace.snapshot.gameData = { version: 'earlyaccess', revision: `sha256:${'a'.repeat(64)}` };
    workspace.snapshot.cores[0].buildings[0].buildingTypeId = 'unavailable_building';
    workspace.snapshot.cores[0].buildings[0].configuration = { kind: 'production', recipeId: 'unavailable_building:recipe' };
    expect(normalizeSaveWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
    workspace.snapshot.gameData.revision = 'invalid';
    expect(() => normalizeSaveWorkspace(workspace)).toThrow();
});
