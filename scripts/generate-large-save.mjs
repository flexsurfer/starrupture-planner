import { readFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDeflate, inflateSync } from 'node:zlib';

// Synthetic import stress fixture, not a playable save. Repeats world data inside an
// unused section so the expected planner snapshot stays identical to the source.
// node scripts/generate-large-save.mjs internal/6.sav /tmp/large-import.sav 12
const [input, output, copiesText = '12'] = process.argv.slice(2);
const copies = Number(copiesText);
if (!input || !output || !Number.isSafeInteger(copies) || copies < 1 || copies > 100) {
    throw new Error('Usage: generate-large-save.mjs source.sav output.sav [copies: 1..100]');
}
const source = await readFile(input);
const json = inflateSync(source.subarray(4)).toString('utf8').trimEnd();
if (!json.endsWith('}') || !JSON.parse(json).itemData) throw new Error('Expected a supported save object');
const prefix = Buffer.from(`${json.slice(0, -1)},"benchmarkPadding":[`);
const entry = Buffer.from(json);
const suffix = Buffer.from(']}');
const decodedBytes = prefix.byteLength + entry.byteLength * copies + copies - 1 + suffix.byteLength;
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
    yield suffix;
})()), createDeflate(), destination);
console.log(JSON.stringify({ output, decodedBytes, synthetic: true }));
