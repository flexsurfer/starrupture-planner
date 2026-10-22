# Streaming save import

Browser imports send the immutable `File` to a worker. The worker reads the
four-byte decoded-length header, streams the remaining zlib data through
`DecompressionStream`, and parses JSON incrementally. The headless byte API
uses the same decoder.

`@streamparser/json`'s `TokenParser` emits one selected record at a time with
`keepStack: false`. A bounded tokenizer uses native `JSON.parse` for individual
strings and primitives, preserving Unicode escapes and lone surrogates across
chunk boundaries. `TextDecoder` validates UTF-8 incrementally. Duplicate JSON
members, prototype setters, trailing commas, incomplete input, and invalid
required structures are rejected.

The parser retains a compact projection of the existing analyzer's inputs:
known building positions/configuration fragments, Core identity/bounds, names,
network IDs, Core levels, transport links, and timestamp. It discards unrelated
world data and unknown entities. The existing analyzer then produces the same
snapshot regardless of source property order. File handles, parser state, and
source records never enter Uklad state or persistence.

## Limits

- Compressed file: 64 MiB.
- Declared and actual unpacked bytes: 512 MiB.
- Web import timeout: 120 seconds, with immediate worker termination on cancel.
- Source objects: up to 1,000,000 keys, subject to the key-character budget below.
  The 100,000-record limit per retained collection applies after unused world
  entities are discarded, so those entities do not count against analyzer inputs.
- Existing analyzer record/fragment limits remain. Parsing additionally bounds
  nesting (128), individual tokens (4 Mi characters), selected records
  (8 Mi characters, checked per chunk), object keys (2,048 characters each and
  4 Mi characters across open containers), and the compact projection
  (16 Mi serialized characters).
- A single stored save can use the full 3 MiB shared budget, measured as UTF-16
  JSON including the persistence envelope. Streaming does not expand localStorage
  capacity or guarantee that a factory with many more retained buildings will
  fit. IndexedDB is a separate change.

The UI distinguishes compressed-size, unpacked-size, complexity, and storage
failures, with English, German, French, and Polish messages. Displayed size
limits come from the decoder constants.

## Reproduce the measurements

Run each benchmark mode in a separate process:

```sh
node scripts/generate-large-save.mjs internal/6.sav /tmp/large-import.sav 12
npx vite-node scripts/benchmark-save-import.ts /tmp/large-import.sav streaming
npx vite-node scripts/benchmark-save-import.ts /tmp/large-import.sav buffered
```

The generator refuses to overwrite an existing file. Its output is a synthetic
import fixture, **not a playable save**: it repeats source world data in an unused
section so the expected planner snapshot stays identical. It stresses input
volume, not the number of retained buildings. The buffered comparison reproduces
the former approach with the old size gate bypassed only for this benchmark.
Only sizes, timings, counts, and a snapshot hash are printed.

Measured with Node 22.18.0 on 2026-10-21:

| Input | Approach | Time | Peak process RSS |
| --- | --- | ---: | ---: |
| 1.10 MiB compressed / 13.48 MiB unpacked | Buffered | 0.13 s | 217 MiB |
| Same sample | Streaming | 0.66 s | 141 MiB |
| 14.04 MiB compressed / 175.30 MiB unpacked | Buffered | 1.50 s | 1,084 MiB |
| Same stress fixture | Streaming | 6.06 s | 167 MiB |
| 39.96 MiB compressed / 498.93 MiB unpacked (36 copies) | Streaming | 17.17 s | 188 MiB |

Each run produced the identical 44,636-byte snapshot with 241 entities. These
are process RSS measurements including the Node/Vite harness (about 118 MiB
before decoding), not browser heap measurements. Streaming trades parsing speed
for a much smaller memory peak; real saves and devices can differ.

The 175 MiB unpacked fixture also imported successfully through the browser file
chooser and rendered the Factory Map. Automated tests cover selected-record
parity, metadata order, one-byte Unicode splits, malformed/oversized inputs,
worker file delivery, cancellation/timeouts, and distinct localized errors.
