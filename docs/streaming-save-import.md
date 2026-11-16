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
network IDs, Core levels, transport links, and timestamp. Placement and bounds
fragments are retained only for Cores, crafting fragments for recipe consumers,
and inventory fragments for storage buildings and launchers. Fragment size/count
validation still runs before this filtering.

Names and network IDs are retained only for imported entities, and levels only
for imported Cores. Metadata appearing before the entity collection uses bounded
pending lookups; closing that collection prunes unrelated entries and releases
their projection budget. Network/level lookups store one scalar per handle,
preserving unknown values for conflicting evidence. Their budget includes the
serialized analyzer records that will be materialized at the end. Transport
links still reach the analyzer even when a sender or receiver is unknown, so
invalid links are rejected. Container paths are cached while validating JSON.

The parser discards unrelated world data and unknown entities. The existing
analyzer then produces the same snapshot regardless of source property order.
File handles, parser state, and source records never enter Uklad state or persistence.

## Limits

- Compressed file: 64 MiB.
- Declared and actual unpacked bytes: 1 GiB (1,024 MiB).
- Web import timeout: 120 seconds. While a save is being read, the import
  dialog cannot be dismissed. Removing the target workspace, switching the
  game data, or disposing the runtime still terminates the worker.
- Source objects: up to 1,000,000 keys, subject to the key-character budget below.
  Up to 100,000 known entities are retained; unused world entities do not count
  against that limit. Electricity metadata accepts up to 500,000 source records.
  Names, Core levels, and transport links each accept up to 100,000 source
  records. Invalid, unrelated, and duplicate-handle metadata still counts toward
  these source-record limits even when its projected value is discarded or merged.
- Other analyzer record/fragment limits remain. Parsing additionally bounds
  nesting (128), individual tokens (4 Mi characters), selected records
  (8 Mi characters, checked per chunk), object keys (2,048 characters each and
  16 Mi characters across open containers), and the compact projection including
  pending metadata (64 Mi serialized characters).
- Up to eight stored saves share 3 MiB, measured as UTF-16 code units of the
  selected JSON or gzip + base64 representation including the persistence envelope. A single
  save can use that entire budget. The expanded collection is bounded to 64 MiB
  of UTF-8 snapshot JSON, separately from the 1 GiB source-file import limit.

The UI distinguishes compressed-size, unpacked-size, complexity, and storage
failures, with English, German, French, and Polish messages. Displayed size
limits come from the decoder constants.

## Snapshot persistence

The runtime keeps the existing typed workspace and snapshot objects. Only the
`savesWorkspaces` persistence root is encoded: UTF-8 JSON is compressed with gzip
and stored as base64 in `{ v: 1, data: { encoding: "gzip-base64", version: 1,
payload: "..." } }`. Encoding uses a fixed gzip timestamp so size calculations
and synchronous Uklad persistence write exactly the same representation.
If gzip + base64 would be larger in UTF-16 storage, plain JSON is retained instead.
This matters for Unicode-heavy names, whose UTF-8 encoding and base64 overhead
can make compression exceed the budget even when the original JSON fits.
Other persisted roots retain their existing formats and storage keys.

Existing plain `{ v: 1, data: workspaces }` records still load, validate, and
detach through the same snapshot schema. Hydration checks their original JSON
budget without compressing them and does not rewrite them; the next workspace
edit stores whichever representation is smaller. Snapshot fields,
coordinate precision, Unicode names, inventories, and references are preserved.

Import admission, collection limits, and serialization all measure the selected
payload. Successful-import telemetry reports `workspaceBytes` for that workspace
stored alone, including its collection key and persistence envelope. This now
measures the selected storage representation including its wrapper.
Collection compression means individual workspace measurements are not additive.

Import admission prepares the standalone workspace once and reuses its measured
size for telemetry. If it is the only workspace, its encoded representation also
serves as the collection; otherwise the combined collection is encoded once.
The checked collection is adopted as a new runtime root using plain snapshots,
without traversing the previous factories through Immer drafts. A weak, one-use
handoff keyed by that exact root lets Persist consume the prepared representation
for its immediate synchronous write. Encoded data never enters application state.
Later edits get a new root and serialize normally; ordinary mutable inputs to the
serializer are never cached. Rejected or abandoned imports do not retain a runtime.

In three production-mode Node measurements using the same eight-workspace,
32 MiB fixture, synchronous import-update time fell from a median of 1.505 s to
0.584 s (about 61% less). This reduces main-thread work while retaining the
existing synchronous durability model; the remaining preparation is synchronous.

Reads check the encoding version, encoded size, expanded length, gzip checksum,
UTF-8, and the existing workspace schema. An extra byte in the bounded output
buffer detects streams that exceed their declared expanded size. Corrupt data
continues to trigger the existing load error and remains in storage for recovery.
Native storage quota failures retain the previous durable value and report the
existing write error.

The browser storage adapter and its matching Persist key configuration share a
one-time handoff of the validated collection. Persist receives a small in-memory
envelope, consumes that collection, and releases the adapter's reference. Loading
therefore decompresses, parses, and normalizes each collection once and never
recompresses it. The handoff is scoped to one persistence attachment and is never
written to storage. Later invalid Saves metadata still preserves earlier valid
reads and allows unrelated settings to persist.

For the reported `1_1.sav` (61 Cores and 3,744 buildings), the complete persisted
envelope measured 1,650,728 bytes as plain JSON and 181,092 bytes with this codec
(1.57 MiB to 0.17 MiB, about 89% smaller). Eight copies with distinct workspace
IDs used 1,440,668 bytes (1.37 MiB). Both legacy loading and compressed round
trips restored identical normalized snapshots. These figures use synthetic
workspace IDs/names; the user's save contents are not checked into the repo.

Hydration regression measurements used five local Node runs through the real
Persist attachment. Eight synthetic workspaces expanded to 32 MiB of JSON and
occupied 0.77 MiB in storage. Removing duplicate decoding/normalization and both
recompression passes reduced median hydration time from 1.877 s to 0.591 s.
A separate Unicode-heavy fixture occupied 1,882,890 bytes as plain JSON but
4,527,260 bytes as gzip + base64; it now loads and remains editable in plain form.

## Complexity diagnostics

Every complexity check attaches a stable `subcode`, the observed `actual` value,
and its `limit`. The worker delivers these as plain data to the transient import
state. The dialog shows the diagnostic and a **Copy error message** button, with
instructions to send the copied report in Discord. Clipboard failure leaves the
text selectable and explains manual copying. Reports contain the localized error
description and locale-independent diagnostic IDs and exact numbers, for example:

```text
Rupture Planner
Save import stopped at an internal limit.

error: complexity
subcode: projection-chars
actual: 67110000
limit: 67108864
```

The report contains only the error description, subcode and counters. It excludes
filenames, user names, source keys and save contents. Starting another import or
closing the dialog clears the previous diagnostic.

| Subcode | Measured value |
| --- | --- |
| `json-token-chars` | Source characters in one JSON token, including quotes/escapes |
| `json-key-chars` | Decoded length of one object key |
| `json-active-key-chars` | Total decoded key length across open containers |
| `json-object-keys` | Keys in one source object, including the offending key |
| `json-container-separators` | Comma separators in one source container |
| `json-depth` | Container nesting depth, including the new container |
| `json-record-chars` | Characters read since a selected record started, checked per chunk |
| `projection-chars` | Sum of serialized retained/pending values and key lengths; network/level metadata uses canonical handle keys and budgets its analyzer record |
| `entity-records` | Entity records passed to the analyzer |
| `power-network-records` | Source electricity node records, before filtering/merging |
| `custom-name-records` | Source custom-name records, before filtering |
| `core-level-records` | Source Core-level records, before filtering/merging |
| `transport-records` | Sender connection records |
| `entity-asset-chars` | Length of an entity asset path |
| `entity-fragment-count` | String fragments on a known entity, before filtering |
| `entity-fragment-chars` | Length of one fragment on a known entity, before filtering |
| `building-name-chars` | Length of a building or Core name |
| `timestamp-chars` | Length of the save timestamp |
| `transport-item-chars` | Length of a sender connection's item asset path |
| `building-core-comparisons` | Building count multiplied by Core count |

Character counters use JavaScript UTF-16 string lengths, not bytes. `actual` is
the value observed at the first failing check; streaming counters need not be the
full-file total and may include the current read chunk. Projection size measures
data currently retained, including metadata awaiting the entity collection;
discarding pending metadata releases that budget.

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

## Dense-world validation

The ignored-padding benchmark above does not exercise retained factory data or
metadata cardinality. Run the dense-world regressions with:

```sh
npx vitest run src/features/saves/decoder/dense-world.test.ts src/features/saves/decoder/stream-json.test.ts
```

They cover 150,000 unrelated electricity nodes before and after entities,
400,000 discarded world entities, and 5,000 production buildings with large
unused inventories. Complete snapshots are compared with the full analyzer or
the same world before unrelated data was added. Additional tests verify conflict
handling, storage/recipe/Core fragment preservation, Unicode chunk boundaries,
dangling transport rejection, and the raised parser budget boundaries.

Measured with Node 22.18.0 on 2026-11-15, before and after metadata/fragment
filtering and cached container paths, in separate benchmark processes:

| Real input | Before | After | Peak process RSS before / after |
| --- | ---: | ---: | ---: |
| 1.10 MiB compressed / 13.48 MiB unpacked | 0.66 s | 0.45 s | 145 / 127 MiB |
| 15.13 MiB compressed / 224.79 MiB unpacked | 10.05 s | 6.24 s | 203 / 190 MiB |

Both real-save snapshot SHA-256 hashes were identical before and after. The
snapshots contained 241 and 3,182 entities and serialized to 50,862 and 685,936
UTF-8 bytes, respectively. These are local Node timings and process RSS, including
the harness; browser/device performance can differ.

## One-GiB unpacked limit

The unpacked limit was raised from 512 MiB to 1 GiB after streaming benchmarks
on 2026-11-15. Both the declared header length and the actual decompressed byte
count enforce the limit. The compressed cap remains 64 MiB and the browser
worker timeout remains 120 seconds.

Generate exact-size fixtures and run each measurement in a fresh process:

```sh
node scripts/generate-large-save.mjs internal/1.sav /tmp/import-512.sav --decoded-mib 512
node scripts/generate-large-save.mjs internal/1.sav /tmp/import-768.sav --decoded-mib 768
node scripts/generate-large-save.mjs internal/1.sav /tmp/import-1024.sav --decoded-mib 1024
npx vite-node scripts/benchmark-save-import.ts /tmp/import-512.sav streaming
npx vite-node scripts/benchmark-save-import.ts /tmp/import-768.sav streaming
npx vite-node scripts/benchmark-save-import.ts /tmp/import-1024.sav streaming
```

This mode preserves the complete original factory and repeats a small block of
source entities in an unused section. Keeping the block below the deflate window
allows 1 GiB unpacked to fit beneath the compressed-file cap. Padding consists
of structured JSON; only a final fraction of a block is whitespace to hit the
exact byte size. These synthetic fixtures measure unpacked volume, not larger
retained factories; use the dense-world tests above for that separate constraint.

| Unpacked | Compressed | Node 22.18.0 import time | Peak process RSS |
| --- | ---: | ---: | ---: |
| 512 MiB | 16.20 MiB | 10.31 s | 191 MiB |
| 768 MiB | 17.95 MiB | 13.44 s | 181 MiB |
| 1,024 MiB | 19.70 MiB | 17.10 s | 180 MiB |

Process baselines were about 120 MiB. A separate 25 ms memory sampler observed
approximately 54 MiB peak JavaScript heap at 1 GiB; sampling can miss brief
peaks. RSS remained broadly flat as unpacked input increased. All three results
matched the original 685,936-byte snapshot's SHA-256 hash.

The exact 1 GiB fixture also passed through the application's browser save worker
in Chromium 157 in 11.94 seconds, including worker startup, context loading, and
result delivery after the local Blob was loaded. Its snapshot hash matched;
a 100 ms main-thread heartbeat had a maximum observed interval of 101 ms.
Browser memory was not measured. These desktop results leave substantial room
within the 120-second timeout, but do not establish performance on slower devices.

Decoder tests cover the production 1 GiB header boundary. Additional tests use
a smaller injected byte budget with real decompression to check exact-limit
acceptance and rejection of actual output exceeding an allowed declared length.
The existing translated messages interpolate the new limit in every locale.
