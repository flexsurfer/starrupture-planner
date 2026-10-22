import { TokenParser, TokenType, type ParsedTokenInfo } from '@streamparser/json';
import { SaveImportError } from '../import-error';
import type { SaveDecodeContext } from './types';
import { createJsonTokenizer } from './json-tokens';

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
const paths = ['$.timestamp', '$.version', ...collectionPaths.map(path => `${path}.*`)];
const requiredPaths = ['$', '$.itemData', '$.itemData.Mass', entityPath];

// Budgets apply while reading, before a large token/record can accumulate in the parser.
const MAX_RECORD_CHARS = 8 * 1024 * 1024;
const MAX_PROJECTION_CHARS = 16 * 1024 * 1024;
const MAX_ACTIVE_KEY_CHARS = 4 * 1024 * 1024;
// Source objects include world entities that are discarded before analysis.
const MAX_OBJECT_KEYS = 1_000_000;
const MAX_RETAINED_RECORDS = 100_000;
const fragmentPrefixes = [
    '/Script/AuActorPlacement.AuAPMassFragment(',
    '/Script/Chimera.CrMassBuildingBaseCoreFragment(',
    '/Script/Chimera.CrCraftingFragment(',
    '/Script/Chimera.CrInventoryFragment(',
];

/** Retain analyzer inputs only; discard unrelated records and fragments. */
function projectEntity(value: unknown, context: SaveDecodeContext): RecordValue | undefined {
    const entity = record(value), spawn = record(entity?.spawnData);
    const asset = spawn?.entityConfigDataPath;
    if (typeof asset !== 'string') return;
    if (asset.length > 2048) throw new SaveImportError('complexity');
    const mapping = context.mappings.buildings.get(asset);
    if (!mapping || !context.buildingIds.has(mapping.id)) return;
    const fragments = Array.isArray(entity?.fragmentValues) ? entity.fragmentValues.filter((entry): entry is string => typeof entry === 'string') : [];
    if (fragments.length > 4096 || fragments.some(fragment => fragment.length > 1024 * 1024)) throw new SaveImportError('complexity');
    const point = record(record(spawn?.transform)?.translation);
    return {
        spawnData: { entityConfigDataPath: asset, transform: { translation: { x: scalar(point?.x), y: scalar(point?.y), z: scalar(point?.z) } } },
        fragmentValues: fragments.filter(fragment => fragmentPrefixes.some(prefix => fragment.startsWith(prefix))),
    };
}

interface Container {
    key: string | number | undefined;
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
    let previous: TokenType | undefined;
    let inputChars = 0, projectionChars = 0, activeKeyChars = 0;

    const guard = ({ token, value, offset }: ParsedTokenInfo.ParsedTokenInfo) => {
        const parent = containers.at(-1);
        if (token === TokenType.STRING && parent?.object && parent.expectsKey) {
            const key = String(value);
            // Reject ambiguous duplicate members and prototype setters rather than silently
            // combining streamed records. Also covers names escaped in the JSON source.
            if (key === '__proto__' || parent.keys.has(key)) throw new SaveImportError('structure');
            activeKeyChars += key.length;
            parent.keyChars += key.length;
            if (key.length > 2048 || activeKeyChars > MAX_ACTIVE_KEY_CHARS || parent.keys.size >= MAX_OBJECT_KEYS) throw new SaveImportError('complexity');
            parent.keys.add(key);
            parent.nextKey = key;
            parent.expectsKey = false;
        } else if (token === TokenType.COMMA) {
            if (parent) {
                parent.expectsKey = parent.object;
                if (!parent.object) parent.nextKey = Number(parent.nextKey) + 1;
                if (++parent.members > 1_000_000) throw new SaveImportError('complexity');
            }
        } else if (token === TokenType.RIGHT_BRACE || token === TokenType.RIGHT_BRACKET) {
            // keepStack:false removes object members; explicitly reject a trailing comma
            // even when the library consequently sees an apparently empty object.
            if (previous === TokenType.COMMA) throw new SaveImportError('structure');
            activeKeyChars -= containers.pop()?.keyChars ?? 0;
        } else if (token !== TokenType.COLON) {
            const keys = [...containers.slice(1).map(container => container.key), ...(parent ? [parent.nextKey] : [])];
            // A period in a source key must never masquerade as a nested selector.
            const path = keys.every(key => typeof key === 'string' && !key.includes('.')) ? ['$', ...keys].join('.') : '';
            if (path === '$.version') throw new SaveImportError('mapping-version');
            if (requiredPaths.includes(path)) {
                if (token !== TokenType.LEFT_BRACE) throw new SaveImportError('structure');
                required.delete(path);
            }
            if (path === transportPath && token !== TokenType.LEFT_BRACE) throw new SaveImportError('transport');
            if (token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET) {
                if (containers.length >= 128) throw new SaveImportError('complexity');
                const parentKeys = containers.slice(1).map(container => container.key);
                const parentPath = parentKeys.every(key => typeof key === 'string' && !key.includes('.')) ? ['$', ...parentKeys].join('.') : '';
                containers.push({ key: parent?.nextKey, object: token === TokenType.LEFT_BRACE,
                    nextKey: token === TokenType.LEFT_BRACKET ? 0 : undefined, expectsKey: token === TokenType.LEFT_BRACE,
                    keys: new Set(), keyChars: 0, members: 0,
                    recordStart: paths.includes(path) || collectionPaths.includes(parentPath) ? offset : null });
            }
        }
        previous = token;
    };
    const tokenizer = createJsonTokenizer(token => { guard(token); parser.write(token); });

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
        const source = record(value);
        let projected: unknown;
        switch (path) {
            case entityPath: projected = projectEntity(value, context); break;
            case networkPath: projected = { handle: { iD: scalar(record(source?.handle)?.iD) },
                subGraph: { subGraphId: scalar(record(source?.subGraph)?.subGraphId) } }; break;
            case namePath: projected = typeof value === 'string' ? value : null; break;
            case levelPath: projected = { baseCore: { iD: scalar(record(source?.baseCore)?.iD) }, upgradeLevel: scalar(source?.upgradeLevel) }; break;
            case transportPath: projected = source ? { item: scalar(source.item), receiver: { iD: scalar(record(source.receiver)?.iD) } } : null; break;
            default: return;
        }
        if (projected === undefined) return;
        const count = (counts.get(path) ?? 0) + 1;
        if (count > MAX_RETAINED_RECORDS) throw new SaveImportError('complexity');
        counts.set(path, count);
        projectionChars += JSON.stringify(projected).length + String(key).length;
        if (projectionChars > MAX_PROJECTION_CHARS) throw new SaveImportError('complexity');
        if (path === levelPath) levels.push(projected);
        else ({ [entityPath]: entities, [networkPath]: nodes, [namePath]: names, [transportPath]: connections })[path][String(key)] = projected;
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
                if (containers.some(container => container.recordStart !== null
                    && inputChars - container.recordStart > MAX_RECORD_CHARS)) throw new SaveImportError('complexity');
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
            return projection;
        },
    };
}
