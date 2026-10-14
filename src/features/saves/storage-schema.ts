import { isValidDataVersion } from '@/features/app-shell/data-version';
import type { Corporation } from '@/app/uklad/model';
import type { SaveGameData } from './game-data';
import { coreKey, isValidSaveBounds, type SaveBounds, type SaveSnapshot, type SaveBuildingConfiguration } from './snapshot';
import type { SaveWorkspace, SaveWorkspaceSelection, SaveCoreObjective } from './types';

export const MAX_SAVE_WORKSPACES = 8;
// UTF-16 budgets leave localStorage space for the Planner, My Bases and settings.
export const MAX_WORKSPACE_BYTES = 1024 * 1024;
export const MAX_SAVES_BYTES = 3 * 1024 * 1024;
export class SaveWorkspaceLimitError extends Error {
    constructor() { super('My Saves storage limit exceeded'); }
}

type Parser<T> = (value: unknown) => T;
const invalid = (): never => { throw new Error('Invalid My Saves storage schema'); };
const text: Parser<string> = value => typeof value === 'string' && value.length <= 512 ? value : invalid();
const number: Parser<number> = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : invalid();
const integer: Parser<number> = value => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 4294967295 ? Number(value) : invalid();
const nullable = <T>(parse: Parser<T>): Parser<T | null> => value => value === null ? null : parse(value);
const oneOf = <const T extends readonly (string | number)[]>(...values: T): Parser<T[number]> =>
    value => values.includes(value as T[number]) ? value as T[number] : invalid();
const array = <T>(parse: Parser<T>, limit = 100_000): Parser<T[]> => value =>
    Array.isArray(value) && value.length <= limit ? value.map(parse) : invalid();
const object = <T extends Record<string, Parser<unknown>>>(shape: T): Parser<{ [K in keyof T]: ReturnType<T[K]> }> => value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(shape).map(([key, parse]) => [key, parse(source[key])])) as { [K in keyof T]: ReturnType<T[K]> };
};
const id: Parser<string> = value => typeof value === 'string' && /^[\w-]{1,128}$/.test(value)
    && !['__proto__', 'prototype', 'constructor'].includes(value) ? value : invalid();
const record = <T>(parse: Parser<T>, limit: number, keyParser = id): Parser<Record<string, T>> => value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const entries = Object.entries(value);
    if (entries.length > limit) return invalid();
    return Object.fromEntries(entries.map(([key, entry]) => [keyParser(key), parse(entry)]));
};
const itemId = id;
const coordinate: Parser<number> = value => typeof value === 'number' && Number.isFinite(value) ? value : invalid();
const position = object({ x: coordinate, y: coordinate, z: coordinate });
const bounds: Parser<SaveBounds | null> = value => {
    if (value === undefined || value === null) return null;
    const parsed = object({ min: position, max: position })(value);
    return isValidSaveBounds(parsed) ? parsed : invalid();
};
const configuration: Parser<SaveBuildingConfiguration> = value => {
    const kind = object({ kind: text })(value).kind;
    switch (kind) {
        case 'production': return object({ kind: oneOf('production'), recipeId: nullable(text) })(value);
        case 'extractor': return object({ kind: oneOf('extractor'), itemId: nullable(itemId), nodePurity: nullable(oneOf('impure', 'normal', 'pure', 'not-applicable')) })(value);
        case 'dispatcher': return object({ kind: oneOf('dispatcher'), itemId: nullable(itemId), receiverId: nullable(integer) })(value);
        case 'launcher': return object({ kind: oneOf('launcher'), itemId: nullable(itemId) })(value);
        default: return object({ kind: oneOf('receiver', 'other') })(value);
    }
};
const snapshotParser: Parser<SaveSnapshot> = object({
    schemaVersion: oneOf(4),
    gameData: object({ version: value => typeof value === 'string' && isValidDataVersion(value) ? value : invalid(),
        revision: value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value) ? value : invalid() }),
    savedAt: nullable(text),
    cores: array(object({ id: integer, spawnTimeSeconds: number, name: nullable(text), powerNetworkId: nullable(integer), position, bounds,
        level: value => value === undefined ? null : nullable(integer)(value),
        buildings: array(object({ id: integer, buildingTypeId: id, name: nullable(text), powerNetworkId: nullable(integer), position, configuration })),
    })),
});

/** Whitelist and detach at import/hydration boundaries; enforce references before adoption. */
export function normalizeSaveSnapshot(value: unknown): SaveSnapshot {
    const snapshot = snapshotParser(value);
    const buildings = snapshot.cores.flatMap(core => core.buildings);
    const entities = [...snapshot.cores, ...buildings];
    if (entities.length > 100_000 || new Set(entities.map(entity => entity.id)).size !== entities.length) invalid();
    const byId = new Map(buildings.map(building => [building.id, building]));
    const receivers = new Set<number>();
    for (const building of buildings) {
        const config = building.configuration;
        if (config.kind === 'production' && config.recipeId !== null && !config.recipeId.startsWith(`${building.buildingTypeId}:`)) invalid();
        if (config.kind === 'dispatcher' && config.receiverId !== null) {
            if (byId.get(config.receiverId)?.configuration.kind !== 'receiver' || receivers.has(config.receiverId)) invalid();
            receivers.add(config.receiverId);
        }
    }
    return snapshot;
}

export function normalizeSaveObjective(value: unknown): SaveCoreObjective {
    const kind = object({ kind: text })(value).kind;
    if (kind === 'corporation') {
        const objective = object({ kind: oneOf('corporation'), corporationId: id, level: integer })(value);
        return objective;
    }
    if (kind === 'intermediate') return object({ kind: oneOf('intermediate'), itemIds: array(itemId, 1000) })(value);
    return object({ kind: oneOf('mission'), name: value => text(value).slice(0, 120), itemIds: array(itemId, 1000) })(value);
}

const workspaceParser: Parser<SaveWorkspace> = object({
    schemaVersion: oneOf(4), id, name: value => {
        const name = text(value).trim();
        return name.length > 0 && name.length <= 120 ? name : invalid();
    },
    snapshot: normalizeSaveSnapshot,
    coreSettings: record(object({ objective: nullable(normalizeSaveObjective) }), 100_000, text),
});
export const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export const localStorageBytes = (value: unknown) => JSON.stringify(value).length * 2;
export const saveCollectionStorageBytes = (value: unknown) => localStorageBytes({ v: 1, data: value });
export function assertSaveStorageLimits(workspaces: Record<string, SaveWorkspace>) {
    if (Object.keys(workspaces).length > MAX_SAVE_WORKSPACES
        || Object.values(workspaces).some(workspace => localStorageBytes(workspace) > MAX_WORKSPACE_BYTES)
        || saveCollectionStorageBytes(workspaces) > MAX_SAVES_BYTES) throw new SaveWorkspaceLimitError();
}
export function normalizeSaveWorkspace(value: unknown): SaveWorkspace {
    const workspace = workspaceParser(value);
    if (localStorageBytes(workspace) > MAX_WORKSPACE_BYTES) throw new SaveWorkspaceLimitError();
    const keys = new Set(workspace.snapshot.cores.map(coreKey));
    if (Object.keys(workspace.coreSettings).some(key => !keys.has(key))) invalid();
    return workspace;
}
export function normalizeSaveWorkspaces(value: unknown): Record<string, SaveWorkspace> {
    const workspaces = record(normalizeSaveWorkspace, MAX_SAVE_WORKSPACES)(value);
    assertSaveStorageLimits(workspaces);
    for (const [key, workspace] of Object.entries(workspaces)) if (workspace.id !== key) invalid();
    return workspaces;
}
export const normalizeSavesOrder = (value: unknown) => [...new Set(array(id, MAX_SAVE_WORKSPACES)(value))];
export const normalizeSavesActiveId = nullable(id);
export const normalizeSavesSelections = record<SaveWorkspaceSelection>(object({ coreId: nullable(integer) }), MAX_SAVE_WORKSPACES);

/** Check new imports/selections against loaded state, separately from storage hydration. */
export function validateSaveSnapshotCatalog(snapshot: SaveSnapshot, version: string, data: SaveGameData): void {
    if (!data.metadata || snapshot.gameData.version !== version || snapshot.gameData.revision !== data.metadata.revision) return invalid();
    for (const building of snapshot.cores.flatMap(core => core.buildings)) {
        const config = building.configuration;
        if (!data.buildings.has(building.buildingTypeId) || data.metadata.kinds[building.buildingTypeId] !== config.kind) invalid();
        if ('itemId' in config && config.itemId !== null && !data.items.has(config.itemId)) invalid();
        if (config.kind === 'production' && config.recipeId !== null && data.recipes.get(config.recipeId)?.buildingId !== building.buildingTypeId) invalid();
    }
}

export function validateSaveObjectiveCatalog(objective: SaveCoreObjective, items: SaveGameData['items'], corporations: Corporation[]): void {
    if (objective.kind === 'corporation') {
        if (!corporations.some(corporation => corporation.id === objective.corporationId && corporation.levels.some(level => level.level === objective.level))) invalid();
    } else if (objective.itemIds.some(id => !items.has(id))) invalid();
}
