import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveFixture } from './decoder/test-fixture';
import { localStorageBytes, normalizeSaveWorkspace } from './storage-schema';
import { createSaveWorkspace } from './workspace';

/** Valid synthetic building names fill uncompressed workspace JSON to an exact UTF-16 budget. */
export function workspaceAtStorageBytes(bytes: number, id = 'one') {
    const original = createSaveWorkspace(id, id, analyzeSave(saveFixture(), extractionContext));
    const template = original.snapshot.cores[0].buildings[0];
    for (const core of original.snapshot.cores) core.buildings = [];
    // Larger budgets need more buildings to stay within the 512-character name limit.
    const buildingCount = Math.max(1000, Math.ceil(bytes / 1024));
    original.snapshot.cores[0].buildings = Array.from({ length: buildingCount }, (_, index) => ({ ...template, id: 1000 + index, name: '' }));
    const workspace = normalizeSaveWorkspace(original);
    let remaining = (bytes - localStorageBytes(workspace)) / 2;
    if (remaining < 0 || !Number.isInteger(remaining)) throw new Error('Invalid synthetic storage budget');
    for (const building of workspace.snapshot.cores[0].buildings) {
        const length = Math.min(remaining, 512);
        building.name = 'x'.repeat(length);
        remaining -= length;
    }
    if (remaining) throw new Error('Synthetic workspace cannot fill the requested budget');
    return workspace;
}

/** Deterministic high-entropy names exercise compressed limits instead of compressing to a few bytes. */
function workspaceWithGeneratedNames(count: number, id: string, seed: number, character: (value: number) => string) {
    const workspace = createSaveWorkspace(id, id, analyzeSave(saveFixture(), extractionContext));
    const template = workspace.snapshot.cores[0].buildings[0];
    for (const core of workspace.snapshot.cores) core.buildings = [];
    const nextCharacter = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return character(seed >>> 0);
    };
    workspace.snapshot.cores[0].buildings = Array.from({ length: count }, (_, index) => ({
        ...template, id: 1000 + index, name: Array.from({ length: 512 }, nextCharacter).join(''),
    }));
    return workspace;
}

export function workspaceWithRandomNames(count: number, id = 'one', seed = 1) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return workspaceWithGeneratedNames(count, id, seed, value => alphabet[value % alphabet.length]);
}

/** BMP names occupy one UTF-16 unit but three UTF-8 bytes per character. */
export function workspaceWithUnicodeNames(count = 1400, id = 'one', seed = 1) {
    return workspaceWithGeneratedNames(count, id, seed, value => String.fromCharCode(0x800 + value % 0xd000));
}
