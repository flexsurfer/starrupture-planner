import { readFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDeflate, inflateSync } from 'node:zlib';

// Synthetic import stress fixture, not a playable save. Repeats world data inside an
// unused section so the expected planner snapshot stays identical to the source.
// node scripts/generate-large-save.mjs internal/6.sav /tmp/large-import.sav 12
// node scripts/generate-large-save.mjs internal/1.sav /tmp/1gib-import.sav --decoded-mib 1024
const [input, output, sizeOption = '12', targetText] = process.argv.slice(2);
const exactSize = sizeOption === '--decoded-mib';
let copies = Number(sizeOption);
const targetBytes = Number(targetText) * 1024 * 1024;
if (!input || !output || (exactSize ? !Number.isSafeInteger(targetBytes) || targetBytes <= 0 || targetBytes > 0xffffffff
    : !Number.isSafeInteger(copies) || copies < 1 || copies > 100)) {
    throw new Error('Usage: generate-large-save.mjs source.sav output.sav [copies: 1..100 | --decoded-mib MiB]');
}
const source = await readFile(input);
const json = inflateSync(source.subarray(4)).toString('utf8').trimEnd();
const value = JSON.parse(json);
if (!json.endsWith('}') || !value.itemData || Object.hasOwn(value, 'benchmarkPadding')) throw new Error('Expected an original supported save object');
const prefix = Buffer.from(`${json.slice(0, -1)},"benchmarkPadding":[`);
let entry = Buffer.from(json);
const suffix = Buffer.from(']}');
let paddingBytes = 0;
if (exactSize) {
    // Repeating a source-entity block smaller than the deflate window exercises
    // structured JSON at large unpacked sizes without crossing the 64 MiB file cap.
    // The original factory above remains intact, including all retained metadata.
    const records = [];
    let blockBytes = 0;
    for (const entity of Object.values(value.itemData.Mass?.entities ?? {})) {
        const serialized = JSON.stringify(entity);
        const serializedBytes = Buffer.byteLength(serialized);
        if (serializedBytes > 8000 || blockBytes + serializedBytes > 16000) continue;
        records.push(serialized);
        blockBytes += serializedBytes + 1;
        if (blockBytes > 12000) break;
    }
    if (!records.length) throw new Error('No source entities for the repeated block');
    entry = Buffer.from(`[${records.join(',')}]`);
    const available = targetBytes - prefix.byteLength - suffix.byteLength;
    copies = Math.floor((available + 1) / (entry.byteLength + 1));
    if (copies < 1 || copies > 1_000_000) throw new Error('Target must fit the source plus 1..1,000,000 entity blocks');
    paddingBytes = available - (copies * entry.byteLength + copies - 1);
}
const decodedBytes = prefix.byteLength + entry.byteLength * copies + copies - 1 + paddingBytes + suffix.byteLength;
if (decodedBytes > 0xffffffff) throw new Error('Fixture exceeds the container length field');
const header = Buffer.alloc(4);
header.writeUInt32LE(decodedBytes);
await mkdir(dirname(output), { recursive: true });
// wx protects existing saves, including the input, from accidental replacement.
const destination = createWriteStream(output, { flags: 'wx' });
destination.write(header);
await pipeline(Readable.from((function* () {
    yield prefix;
    for (let index = 0; index < copies; index++) { if (index) yield ','; yield entry; }
    if (paddingBytes) yield Buffer.alloc(paddingBytes, 32);
    yield suffix;
})()), createDeflate(), destination);
console.log(JSON.stringify({ output, decodedBytes, synthetic: true,
    ...(exactSize ? { blockBytes: entry.byteLength, copies, whitespaceBytes: paddingBytes } : {}) }));
