import { TokenParser, TokenType, type ParsedTokenInfo } from '@streamparser/json';
import { assertSaveImportLimit, SaveImportError, type SaveImportDiagnostic } from '../import-error';
import { MAX_SAVE_ACTIVE_KEY_CHARS, MAX_SAVE_POWER_NETWORK_RECORDS, MAX_SAVE_PROJECTION_CHARS } from '../import-limits';
import type { SaveDecodeContext } from './types';
import { createJsonTokenizer } from './json-tokens';
import { entityId, handle } from './handles';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
const dictionary = (): RecordValue => Object.create(null) as RecordValue;
const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? value : null;

const entityPath = '$.itemData.Mass.entities';
const networkPath = '$.itemData.Mass.electricitySubsystemState.nodeData';
const namePath = '$.itemData.CrBuildingCustomNameSubsystem.customNames';
const levelPath = '$.itemData.BaseCoreReplicationHelperSaveData.baseCoreSaveData';
const transportPath = '$.itemData.CrPackageTransportReplicator.senderConnections';
const collectionPaths = [entityPath, networkPath, namePath, levelPath, transportPath];
const collectionDiagnostics: Record<string, SaveImportDiagnostic['subcode']> = {
    [entityPath]: 'entity-records', [networkPath]: 'power-network-records', [namePath]: 'custom-name-records',
    [levelPath]: 'core-level-records', [transportPath]: 'transport-records',
};
const paths = ['$.timestamp', '$.version', ...collectionPaths.map(path => `${path}.*`)];
const requiredPaths = ['$', '$.itemData', '$.itemData.Mass', entityPath];

// Budgets apply while reading, before a large token/record can accumulate in the parser.
const MAX_RECORD_CHARS = 8 * 1024 * 1024;
// Source objects include world entities that are discarded before analysis.
const MAX_OBJECT_KEYS = 1_000_000;
const MAX_RETAINED_RECORDS = 100_000;

/** Retain analyzer inputs only; discard unrelated records and fragments. */
function projectEntity(value: unknown, context: SaveDecodeContext): { value: RecordValue; isCore: boolean } | undefined {
    const entity = record(value), spawn = record(entity?.spawnData);
    const asset = spawn?.entityConfigDataPath;
    if (typeof asset !== 'string') return;
    assertSaveImportLimit('entity-asset-chars', asset.length, 2048);
    const mapping = context.mappings.buildings.get(asset);
    if (!mapping || !context.buildingIds.has(mapping.id)) return;
    const fragments = Array.isArray(entity?.fragmentValues) ? entity.fragmentValues.filter((entry): entry is string => typeof entry === 'string') : [];
    assertSaveImportLimit('entity-fragment-count', fragments.length, 4096);
    for (const fragment of fragments) assertSaveImportLimit('entity-fragment-chars', fragment.length, 1024 * 1024);
    const point = record(record(spawn?.transform)?.translation);
    const isCore = mapping.role === 'core';
    const needsInventory = !isCore && (context.storageBuildingIds.has(mapping.id) || mapping.role === 'launcher');
    const needsRecipe = !isCore && (Boolean(mapping.extractor) || context.mappings.recipes.has(mapping.id));
    return { isCore, value: {
        spawnData: { entityConfigDataPath: asset, transform: { translation: { x: scalar(point?.x), y: scalar(point?.y), z: scalar(point?.z) } } },
        fragmentValues: fragments.filter(fragment =>
            (isCore && (fragment.startsWith('/Script/AuActorPlacement.AuAPMassFragment(')
                || fragment.startsWith('/Script/Chimera.CrMassBuildingBaseCoreFragment(')))
            || (needsRecipe && fragment.startsWith('/Script/Chimera.CrCraftingFragment('))
            || (needsInventory && fragment.startsWith('/Script/Chimera.CrInventoryFragment('))),
    } };
}

interface Container {
    path: string;
    object: boolean;
    nextKey: string | number | undefined;
    expectsKey: boolean;
    keys: Set<string>;
    keyChars: number;
    members: number;
    recordStart: number | null;
}

/** Select complete records, release them immediately, then analyze the compact projection. */
export function createSaveJsonParser(context: SaveDecodeContext) {
    const entities = dictionary(), nodes = dictionary(), names = dictionary(), connections = dictionary();
    const levels: unknown[] = [];
    const projection: RecordValue = { itemData: {
        Mass: { entities, electricitySubsystemState: { nodeData: nodes } },
        CrBuildingCustomNameSubsystem: { customNames: names },
        BaseCoreReplicationHelperSaveData: { baseCoreSaveData: levels },
        CrPackageTransportReplicator: { senderConnections: connections },
    } };
    const parser = new TokenParser({ paths, keepStack: false });
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const containers: Container[] = [];
    const required = new Set(requiredPaths);
    const counts = new Map<string, number>();
    const entityIds = new Set<number>(), coreIds = new Set<number>();
    const networks = new Map<number, number | null>(), coreLevels = new Map<number, number | null>();
    const networkRecord = (id: number, value: number | null) => ({ handle: { iD: id }, subGraph: { subGraphId: value } });
    const levelRecord = (id: number, value: number | null) => ({ baseCore: { iD: id }, upgradeLevel: value });
    type MetadataRecord = typeof networkRecord | typeof levelRecord;
    let entitiesComplete = false;
    let previous: TokenType | undefined;
    let inputChars = 0, projectionChars = 0, activeKeyChars = 0;

    const projectedChars = (key: string, value: unknown) => key.length + JSON.stringify(value).length;
    const reserve = (chars: number) => {
        projectionChars += chars;
        assertSaveImportLimit('projection-chars', projectionChars, MAX_SAVE_PROJECTION_CHARS);
    };
    const retain = (target: RecordValue, key: string, value: unknown) => {
        reserve(projectedChars(key, value));
        target[key] = value;
    };
    // Store a single scalar per handle, including sticky nulls for conflicting evidence.
    // Budget the eventual analyzer record as well, without retaining all its wrapper objects.
    const retainMetadata = (target: Map<number, number | null>, relevantIds: Set<number>, project: MetadataRecord,
        id: number | null, value: number | null) => {
        if (id === null || (entitiesComplete && !relevantIds.has(id))) return;
        const present = target.has(id), previous = target.get(id) ?? null;
        const next = present && previous !== value ? null : value;
        reserve(projectedChars(String(id), project(id, next)) - (present ? projectedChars(String(id), project(id, previous)) : 0));
        target.set(id, next);
    };
    const pruneMetadata = (target: Map<number, number | null>, relevantIds: Set<number>, project: MetadataRecord) => {
        for (const [id, value] of target) {
            if (relevantIds.has(id)) continue;
            projectionChars -= projectedChars(String(id), project(id, value));
            target.delete(id);
        }
    };
    const finishEntities = () => {
        entitiesComplete = true;
        pruneMetadata(networks, entityIds, networkRecord);
        pruneMetadata(coreLevels, coreIds, levelRecord);
        for (const key of Object.keys(names)) {
            if (Object.hasOwn(entities, key)) continue;
            projectionChars -= projectedChars(key, names[key]);
            delete names[key];
        }
    };

    const guard = ({ token, value, offset }: ParsedTokenInfo.ParsedTokenInfo) => {
        const parent = containers.at(-1);
        if (token === TokenType.STRING && parent?.object && parent.expectsKey) {
            const key = String(value);
            // Reject ambiguous duplicate members and prototype setters rather than silently
            // combining streamed records. Also covers names escaped in the JSON source.
            if (key === '__proto__' || parent.keys.has(key)) throw new SaveImportError('structure');
            activeKeyChars += key.length;
            parent.keyChars += key.length;
            assertSaveImportLimit('json-key-chars', key.length, 2048);
            assertSaveImportLimit('json-active-key-chars', activeKeyChars, MAX_SAVE_ACTIVE_KEY_CHARS);
            assertSaveImportLimit('json-object-keys', parent.keys.size + 1, MAX_OBJECT_KEYS);
            parent.keys.add(key);
            parent.nextKey = key;
            parent.expectsKey = false;
        } else if (token === TokenType.COMMA) {
            if (parent) {
                parent.expectsKey = parent.object;
                if (!parent.object) parent.nextKey = Number(parent.nextKey) + 1;
                assertSaveImportLimit('json-container-separators', ++parent.members, 1_000_000);
            }
        } else if (token === TokenType.RIGHT_BRACE || token === TokenType.RIGHT_BRACKET) {
            // keepStack:false removes object members; explicitly reject a trailing comma
            // even when the library consequently sees an apparently empty object.
            if (previous === TokenType.COMMA) throw new SaveImportError('structure');
            activeKeyChars -= containers.pop()?.keyChars ?? 0;
        } else if (token !== TokenType.COLON) {
            // A period in a source key must never masquerade as a nested selector.
            const path = parent
                ? parent.path && typeof parent.nextKey === 'string' && !parent.nextKey.includes('.') ? `${parent.path}.${parent.nextKey}` : ''
                : '$';
            if (path === '$.version') throw new SaveImportError('mapping-version');
            if (requiredPaths.includes(path)) {
                if (token !== TokenType.LEFT_BRACE) throw new SaveImportError('structure');
                required.delete(path);
            }
            if (path === transportPath && token !== TokenType.LEFT_BRACE) throw new SaveImportError('transport');
            if (token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET) {
                assertSaveImportLimit('json-depth', containers.length + 1, 128);
                const parentPath = parent?.path ?? '$';
                containers.push({ path, object: token === TokenType.LEFT_BRACE,
                    nextKey: token === TokenType.LEFT_BRACKET ? 0 : undefined, expectsKey: token === TokenType.LEFT_BRACE,
                    keys: new Set(), keyChars: 0, members: 0,
                    recordStart: paths.includes(path) || collectionPaths.includes(parentPath) ? offset : null });
            }
        }
        previous = token;
    };
    const tokenizer = createJsonTokenizer(token => {
        const endsEntities = token.token === TokenType.RIGHT_BRACE && containers.at(-1)?.path === entityPath;
        guard(token);
        parser.write(token);
        if (endsEntities) finishEntities();
    });

    parser.onValue = ({ value, key, parent, stack }) => {
        const path = ['$', ...stack.slice(1).map(entry => entry.key)].join('.');
        if (!stack.length) return;
        if (stack.length === 1) {
            if (key === 'version') throw new SaveImportError('mapping-version');
            if (key === 'timestamp') projection.timestamp = typeof value === 'string' ? value : null;
            return;
        }
        // Optional maps must be objects, and Core level records must be an array.
        if (path === levelPath ? !Array.isArray(parent) : typeof key !== 'string' || Array.isArray(parent)) return;
        if (!collectionPaths.includes(path)) return;
        const source = record(value);
        const entity = path === entityPath ? projectEntity(value, context) : undefined;
        if (path === entityPath && !entity) return;
        const count = (counts.get(path) ?? 0) + 1;
        // Source metadata is bounded even if it is invalid, irrelevant, or duplicates a handle.
        assertSaveImportLimit(collectionDiagnostics[path], count, path === networkPath ? MAX_SAVE_POWER_NETWORK_RECORDS : MAX_RETAINED_RECORDS);
        counts.set(path, count);
        switch (path) {
            case entityPath: {
                retain(entities, String(key), entity!.value);
                const id = entityId(String(key));
                if (id !== null) { entityIds.add(id); if (entity!.isCore) coreIds.add(id); }
                break;
            }
            case networkPath:
                retainMetadata(networks, entityIds, networkRecord, handle(record(source?.handle)?.iD), handle(record(source?.subGraph)?.subGraphId));
                break;
            case namePath:
                if (typeof value === 'string' && entityId(String(key)) !== null && (!entitiesComplete || Object.hasOwn(entities, String(key)))) {
                    retain(names, String(key), value);
                }
                break;
            case levelPath:
                retainMetadata(coreLevels, coreIds, levelRecord, handle(record(source?.baseCore)?.iD), handle(source?.upgradeLevel));
                break;
            case transportPath:
                // Unknown senders/receivers must still reach the analyzer's transport validation.
                retain(connections, String(key), source ? { item: scalar(source.item), receiver: { iD: scalar(record(source.receiver)?.iD) } } : null);
                break;
        }
    };

    return {
        write(chunk: Uint8Array) {
            // Split caller chunks so budgets also apply to Blob streams with large chunks.
            for (let offset = 0; offset < chunk.byteLength; offset += 64 * 1024) {
                const part = chunk.subarray(offset, offset + 64 * 1024);
                let text: string;
                try { text = decoder.decode(part, { stream: true }); }
                catch { throw new SaveImportError('compression'); }
                inputChars += text.length;
                for (const container of containers) {
                    if (container.recordStart !== null) assertSaveImportLimit('json-record-chars', inputChars - container.recordStart, MAX_RECORD_CHARS);
                }
                try { tokenizer.write(text); }
                catch (error) { throw error instanceof SaveImportError ? error : new SaveImportError('structure'); }
            }
        },
        end(): unknown {
            try { decoder.decode(); }
            catch { throw new SaveImportError('compression'); }
            try { tokenizer.end(); if (!parser.isEnded) parser.end(); }
            catch (error) { throw error instanceof SaveImportError ? error : new SaveImportError('structure'); }
            if (required.size) throw new SaveImportError('structure');
            for (const [id, value] of networks) nodes[String(id)] = networkRecord(id, value);
            for (const [id, value] of coreLevels) levels.push(levelRecord(id, value));
            networks.clear(); coreLevels.clear();
            return projection;
        },
    };
}
