import type { SaveBuilding, SaveBuildingConfiguration, SaveCore, SaveSnapshot } from '../snapshot';
import { fragmentFields } from './fragments';
import { readLauncherItem } from './launchers';
import type { SaveBuildingMapping } from './mappings';
import { selectedRecipe } from './recipes';
import { SaveImportError } from '../import-error';
import type { SaveDecodeContext } from './types';

type RecordValue = Record<string, unknown>;
type Position = { x: number; y: number; z: number };
const record = (value: unknown): RecordValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const handle = (value: unknown): number | null => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 4294967295 ? Number(value) : null;
const entityId = (key: string) => /^\(ID=(0|[1-9]\d*)\)$/.test(key) ? handle(Number(key.slice(4, -1))) : null;
function text(value: unknown, max = 512): string | null {
    if (typeof value !== 'string' || !value.length) return null;
    if (value.length > max) throw new SaveImportError('complexity');
    return value;
}
function position(value: unknown): Position {
    const point = record(value);
    const x = number(point?.x), y = number(point?.y), z = number(point?.z);
    if (x === null || y === null || z === null) throw new SaveImportError('position');
    return { x, y, z };
}
function spawnTime(fragments: string[]): number {
    const prefix = '/Script/AuActorPlacement.AuAPMassFragment';
    const matches = fragments.filter(fragment => fragment.startsWith(`${prefix}(`));
    const value = matches.length === 1 ? fragmentFields(matches[0], prefix)?.get('SpawnServerTimeSeconds') : undefined;
    if (!value || !/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
        throw new SaveImportError('core-identity');
    }
    return Number(value);
}

function configuration(mapping: SaveBuildingMapping, fragments: string[], context: SaveDecodeContext): SaveBuildingConfiguration {
    const asset = selectedRecipe(fragments);
    const knownItem = (id: string | null) => id && context.itemIds.has(id) ? id : null;
    if (mapping.extractor) {
        const recipe = asset ? mapping.extractor.recipes.get(asset) : undefined;
        return { kind: 'extractor', itemId: knownItem(recipe?.itemId ?? null), nodePurity: recipe?.purity ?? null };
    }
    if (mapping.role === 'dispatcher') return { kind: 'dispatcher', itemId: null, receiverId: null };
    if (mapping.role === 'receiver') return { kind: 'receiver' };
    if (mapping.role === 'launcher') return { kind: 'launcher', itemId: knownItem(readLauncherItem(fragments, context.mappings.items)) };
    if (context.mappings.recipes.has(mapping.id)) {
        const recipe = asset ? context.mappings.recipes.get(mapping.id)?.get(asset) : undefined;
        return { kind: 'production', recipeId: recipe?.catalogRecipeId ?? null };
    }
    return { kind: 'other' };
}

/** A unique known grid is useful app data; missing or conflicting evidence stays unknown. */
function powerNetworks(mass: RecordValue): Map<number, number | null> {
    const nodes = Object.values(record(record(mass.electricitySubsystemState)?.nodeData) ?? {});
    if (nodes.length > 100_000) throw new SaveImportError('complexity');
    const result = new Map<number, number | null>();
    for (const value of nodes) {
        const node = record(value);
        const id = handle(record(node?.handle)?.iD);
        if (id === null) continue;
        const network = handle(record(node?.subGraph)?.subGraphId);
        result.set(id, result.has(id) && result.get(id) !== network ? null : network);
    }
    return result;
}

function coreLevels(itemData: RecordValue): Map<number, number | null> {
    const entries = record(itemData.BaseCoreReplicationHelperSaveData)?.baseCoreSaveData;
    const result = new Map<number, number | null>();
    if (!Array.isArray(entries)) return result;
    if (entries.length > 100_000) throw new SaveImportError('complexity');
    for (const value of entries) {
        const entry = record(value);
        const id = handle(record(entry?.baseCore)?.iD);
        if (id === null) continue;
        const level = handle(entry?.upgradeLevel);
        result.set(id, result.has(id) && result.get(id) !== level ? null : level);
    }
    return result;
}

function connectTransport(itemData: RecordValue, buildings: SaveBuilding[], context: SaveDecodeContext): void {
    const raw = record(itemData.CrPackageTransportReplicator)?.senderConnections;
    if (raw === undefined) return;
    const connections = record(raw);
    if (!connections) throw new SaveImportError('transport');
    const entries = Object.entries(connections);
    if (entries.length > 100_000) throw new SaveImportError('complexity');
    const byId = new Map(buildings.map(building => [building.id, building]));
    const receivers = new Set<number>();
    for (const [key, value] of entries) {
        const sender = byId.get(entityId(key) ?? -1);
        const link = record(value);
        if (!sender || sender.configuration.kind !== 'dispatcher' || !link) throw new SaveImportError('transport');
        const config = sender.configuration;
        const item = text(link.item, 2048);
        const itemId = item ? context.mappings.items.get(item) : undefined;
        config.itemId = itemId && context.itemIds.has(itemId) ? itemId : null;
        const rawReceiver = record(link.receiver)?.iD;
        if (rawReceiver === 4294967295) continue;
        const receiverId = handle(rawReceiver);
        if (receiverId === null || byId.get(receiverId)?.configuration.kind !== 'receiver' || receivers.has(receiverId)) {
            throw new SaveImportError('transport');
        }
        receivers.add(receiverId);
        config.receiverId = receiverId;
    }
}

/** Project decoded save data straight into the app contract. No source records escape. */
export function analyzeSave(value: unknown, context: SaveDecodeContext): SaveSnapshot {
    if (context.mappings.dataVersion !== context.dataVersion) {
        throw new SaveImportError('mapping-version');
    }
    const root = record(value), itemData = record(root?.itemData), mass = record(itemData?.Mass);
    const entities = record(mass?.entities);
    if (!root || !itemData || !mass || !entities) throw new SaveImportError('structure');
    // The supported container has no explicit format version; do not guess at a different schema.
    if (root.version !== undefined) throw new SaveImportError('mapping-version');
    const entries = Object.entries(entities);
    if (entries.length > 100_000) throw new SaveImportError('complexity');
    const names = record(record(itemData.CrBuildingCustomNameSubsystem)?.customNames);
    const networks = powerNetworks(mass);
    const levels = coreLevels(itemData);
    const cores: { core: SaveCore; position: Position }[] = [];
    const buildings: { building: SaveBuilding; position: Position }[] = [];
    const ids = new Set<number>();
    for (const [key, value] of entries) {
        const entity = record(value), spawn = record(entity?.spawnData);
        const asset = text(spawn?.entityConfigDataPath, 2048);
        const mapping = asset ? context.mappings.buildings.get(asset) : undefined;
        if (!mapping || !context.buildingIds.has(mapping.id)) continue;
        const id = entityId(key);
        if (id === null || ids.has(id)) throw new SaveImportError(mapping.role === 'core' ? 'core-identity' : 'structure');
        ids.add(id);
        const fragments = Array.isArray(entity?.fragmentValues) ? entity.fragmentValues.filter((value): value is string => typeof value === 'string') : [];
        if (fragments.length > 4096 || fragments.some(fragment => fragment.length > 1024 * 1024)) throw new SaveImportError('complexity');
        const common = { id, name: text(names?.[key]), powerNetworkId: networks.get(id) ?? null };
        if (mapping.role === 'core') {
            const core: SaveCore = { ...common, spawnTimeSeconds: spawnTime(fragments), level: levels.get(id) ?? null, buildings: [] };
            cores.push({ core, position: position(record(spawn?.transform)?.translation) });
        } else {
            buildings.push({ building: { ...common, buildingTypeId: mapping.id, configuration: configuration(mapping, fragments, context) },
                position: position(record(spawn?.transform)?.translation) });
        }
    }
    cores.sort((a, b) => a.core.id - b.core.id);
    buildings.sort((a, b) => a.building.id - b.building.id);
    if (buildings.length && !cores.length) throw new SaveImportError('position');
    if (buildings.length * cores.length > 10_000_000) throw new SaveImportError('complexity');
    for (const entry of buildings) {
        // All Cores participate. Exact ties choose the lowest Core ID, independently of source order.
        let nearest = cores[0], closest = Infinity;
        for (const candidate of cores) {
            const distance = Math.hypot(entry.position.x - candidate.position.x, entry.position.y - candidate.position.y, entry.position.z - candidate.position.z);
            if (!Number.isFinite(distance)) throw new SaveImportError('position');
            if (distance < closest) { nearest = candidate; closest = distance; }
        }
        nearest.core.buildings.push(entry.building);
    }
    connectTransport(itemData, buildings.map(entry => entry.building), context);
    return { schemaVersion: 3, gameData: { version: context.dataVersion, revision: context.mappings.mappingRevision },
        savedAt: text(root.timestamp), cores: cores.map(entry => entry.core) };
}
