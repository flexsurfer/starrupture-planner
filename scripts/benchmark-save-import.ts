import { openAsBlob } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { decodeSave } from '../src/features/saves/decoder/decode';
import { analyzeSave } from '../src/features/saves/decoder/analyze';
import type { SaveDecodeContext } from '../src/features/saves/decoder/types';
import { DEFAULT_DATA_VERSION } from '../src/features/app-shell/data-version';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion, loadHeadlessSaveContext } from '../src/platform/headless/game-data-loader';

// Run each mode in a fresh process for comparable process peak RSS (not browser heap).
// npx vite-node scripts/benchmark-save-import.ts /tmp/large-import.sav streaming
// npx vite-node scripts/benchmark-save-import.ts /tmp/large-import.sav buffered
const [path, mode = 'streaming'] = process.argv.slice(2);
if (!path || !['streaming', 'buffered'].includes(mode)) throw new Error('Pass a .sav path and streaming or buffered');
const file = await openAsBlob(path);
const catalog = gameDataBundleToAppVersioned(await loadHeadlessGameDataVersion(DEFAULT_DATA_VERSION));
const context = await loadHeadlessSaveContext({ dataVersion: DEFAULT_DATA_VERSION, buildings: catalog.buildings, items: catalog.items });

/** Previous buffering strategy, with its old size gate bypassed ONLY for this comparison. */
async function buffered(blob: Blob, decodeContext: SaveDecodeContext) {
    const bytes = await blob.arrayBuffer();
    const reader = new Blob([bytes.slice(4)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const decoder = new TextDecoder('utf8', { fatal: true });
    const parts: string[] = [];
    let size = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            parts.push(decoder.decode(chunk.value, { stream: true }));
        }
        parts.push(decoder.decode());
    } finally { reader.releaseLock(); }
    if (size !== new DataView(bytes).getUint32(0, true)) throw new Error('Decoded length mismatch');
    return analyzeSave(JSON.parse(parts.join('')), decodeContext);
}

const baselineRss = process.memoryUsage().rss;
const start = performance.now();
const snapshot = await (mode === 'streaming' ? decodeSave(file, context) : buffered(file, context));
const elapsedMs = performance.now() - start;
const snapshotJson = JSON.stringify(snapshot);
const mib = (bytes: number) => Math.round(bytes / 1048576 * 100) / 100;
console.log(JSON.stringify({ mode, compressedMiB: mib(file.size),
    decodedMiB: mib(new DataView(await file.slice(0, 4).arrayBuffer()).getUint32(0, true)),
    elapsedMs: Math.round(elapsedMs), baselineRssMiB: mib(baselineRss),
    peakRssMiB: mib(process.resourceUsage().maxRSS * 1024),
    snapshotBytes: Buffer.byteLength(snapshotJson), snapshotSha256: createHash('sha256').update(snapshotJson).digest('hex'),
    entities: snapshot.cores.reduce((total, core) => total + 1 + core.buildings.length, 0),
}, null, 2));
