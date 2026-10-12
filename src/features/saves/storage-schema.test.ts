import { createSaveWorkspace } from './workspace';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveFixture } from './decoder/test-fixture';
// @vitest-environment node
import { expect, it } from 'vitest';
import { assertSaveStorageLimits, jsonBytes, localStorageBytes, MAX_SAVES_BYTES, MAX_WORKSPACE_BYTES, normalizeSaveWorkspace, normalizeSaveWorkspaces, saveCollectionStorageBytes, SaveWorkspaceLimitError } from './storage-schema';
import { workspaceAtStorageBytes } from './storage-test-fixture';

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
    workspace.coreSettings['1:10.5'] = { objective: { kind: 'corporation', corporationId: 'unavailable_corporation', level: 7 } };
    expect(normalizeSaveWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
    workspace.snapshot.gameData.revision = 'invalid';
    expect(() => normalizeSaveWorkspace(workspace)).toThrow();
});
