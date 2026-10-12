import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { decodeSave } from '../src/features/saves/decoder/decode';
import { createSaveWorkspace } from '../src/features/saves/workspace';
import { jsonBytes, localStorageBytes, saveCollectionStorageBytes, normalizeSaveWorkspaces } from '../src/features/saves/storage-schema';
import { DEFAULT_DATA_VERSION, isValidDataVersion } from '../src/features/app-shell/data-version';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion, loadHeadlessSaveContext } from '../src/platform/headless/game-data-loader';

/** Run with: npx vite-node scripts/measure-save-workspaces.ts /path/to/save.sav */
const path = process.argv.slice(2).find(arg => arg.endsWith('.sav'));
if (!path) throw new Error('Pass the path to a supported .sav file.');
const bytes = Uint8Array.from(await readFile(path)).buffer;
const selectedVersion = process.argv.find(arg => arg.startsWith('--version='))?.slice('--version='.length) ?? DEFAULT_DATA_VERSION;
if (!isValidDataVersion(selectedVersion)) throw new Error('Unknown game-data version');
const catalog = gameDataBundleToAppVersioned(await loadHeadlessGameDataVersion(selectedVersion));
const context = await loadHeadlessSaveContext({ dataVersion: selectedVersion, buildings: catalog.buildings, items: catalog.items });
const report = await decodeSave(bytes, context);
const workspace = createSaveWorkspace('sample', 'Sample', report);
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const rows = [];
for (const count of [1, 2, 4]) {
    // Copies stress collection size; they do not claim to be different real worlds.
    const records = Object.fromEntries(Array.from({ length: count }, (_, index) => [
        `sample-${index}`, { ...workspace, id: `sample-${index}` },
    ]));
    const serializeMs: number[] = [], parseAndValidateMs: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
        let start = performance.now();
        const encoded = JSON.stringify(records);
        serializeMs.push(performance.now() - start);
        start = performance.now();
        normalizeSaveWorkspaces(JSON.parse(encoded));
        parseAndValidateMs.push(performance.now() - start);
    }
    rows.push({ workspaces: count, bytes: jsonBytes(records), localStorageBytes: saveCollectionStorageBytes(records), serializeMs: median(serializeMs), parseAndValidateMs: median(parseAndValidateMs) });
}
// Only sizes/timings leave the process; no names, locations or normalized facts are written.
console.log(JSON.stringify({ entities: report.cores.reduce((total, core) => total + 1 + core.buildings.length, 0), reportBytes: jsonBytes(report), workspaceBytes: jsonBytes(workspace), workspaceLocalStorageBytes: localStorageBytes(workspace), measurements: rows }, null, 2));
