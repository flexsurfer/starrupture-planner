import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeOverlapFixture } from '../test/fixtures/factory-map-overlaps';
import { decodeSave } from '../src/features/saves/decoder/decode';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion, loadHeadlessSaveContext } from '../src/platform/headless/game-data-loader';

const dataVersion = 'update2_QoL';
const catalog = gameDataBundleToAppVersioned(await loadHeadlessGameDataVersion(dataVersion));
const context = await loadHeadlessSaveContext({ dataVersion, buildings: catalog.buildings, items: catalog.items });
const bytes = encodeOverlapFixture();
const snapshot = await decodeSave(bytes.buffer, context);
const buildings = snapshot.cores.flatMap(core => core.buildings);
if (snapshot.cores.length !== 8 || buildings.length !== 44) throw new Error('Incomplete overlap fixture.');
if (buildings.some(building => building.configuration.kind === 'production' && !building.configuration.recipeId)) {
    throw new Error('A fixture recipe was not recognized.');
}
const path = resolve('test/fixtures/factory-map-overlaps.sav');
await writeFile(path, bytes);
console.log(`Created ${path}\n${snapshot.cores.length} Cores, ${buildings.length} buildings, ${bytes.length} bytes.\nSynthetic planner fixture; not a playable StarRupture save.`);
