import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveFixture } from './decoder/test-fixture';
import { localStorageBytes, normalizeSaveWorkspace } from './storage-schema';
import { createSaveWorkspace } from './workspace';

/** Valid synthetic building names fill a workspace to an exact UTF-16 budget. */
export function workspaceAtStorageBytes(bytes: number, id = 'one') {
    const original = createSaveWorkspace(id, id, analyzeSave(saveFixture(), extractionContext));
    const template = original.snapshot.cores[0].buildings[0];
    for (const core of original.snapshot.cores) core.buildings = [];
    original.snapshot.cores[0].buildings = Array.from({ length: 1000 }, (_, index) => ({ ...template, id: 1000 + index, name: '' }));
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
