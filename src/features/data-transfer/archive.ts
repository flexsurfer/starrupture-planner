import type { AppState, Base, BaseBuilding, EnergyGroup } from '@/app/uklad/model';
import type { PlannerTab } from '@/features/planner/state';
import type { BasesMode } from '@/features/bases/state';
import { resolveInputBuilding } from '@/utils/productionPlanInputs';

export const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;

export interface PlannerArchive {
    format: 'rupture-planner';
    version: 1;
    dataVersion: string;
    basesMode: BasesMode | null;
    bases: Base[];
    plans: PlannerTab[];
    energyGroups: EnergyGroup[];
}

export interface ArchiveSelection {
    /** null selects the entire collection. */
    baseIds: string[] | null;
    planIds: string[] | null;
}

export interface TransferStatus {
    kind: 'success' | 'error';
    message: string;
}

export interface DataTransferState {
    dataTransferPreview: PlannerArchive | null;
    dataTransferStatus: TransferStatus | null;
}

export function createDataTransferState(): DataTransferState {
    return { dataTransferPreview: null, dataTransferStatus: null };
}

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Freeze live logistics values in the file, including links to omitted bases. */
export function createArchive(state: Pick<AppState, 'basesList' | 'plannerTabs' | 'energyGroups' | 'appDataVersion' | 'basesMode'>, selection: ArchiveSelection): PlannerArchive {
    const bases = copy(state.basesList.filter(base => selection.baseIds === null || selection.baseIds.includes(base.id)));
    for (const base of bases) {
        for (const building of [...base.buildings, ...base.productions.flatMap(plan => plan.inputs ?? [])]) {
            if (!building.linkedOutput) continue;
            const resolved = resolveInputBuilding(building, state.basesList);
            building.linkedOutput.itemIdSnapshot = resolved.selectedItemId;
            building.linkedOutput.ratePerMinuteSnapshot = resolved.ratePerMinute;
        }
    }
    const groupIds = new Set(bases.map(base => base.energyGroupId));
    return {
        format: 'rupture-planner', version: 1, dataVersion: state.appDataVersion, basesMode: state.basesMode,
        bases,
        plans: copy(state.plannerTabs.filter(plan => selection.planIds === null || selection.planIds.includes(plan.id))),
        energyGroups: copy(state.energyGroups.filter(group => groupIds.has(group.id))),
    };
}

/** Select from a prepared preview without changing its IDs or runtime-owned data. */
export function selectArchiveImports(archive: PlannerArchive, selection: ArchiveSelection): PlannerArchive {
    const bases = copy(archive.bases.filter(base => selection.baseIds === null || selection.baseIds.includes(base.id)));
    const plans = copy(archive.plans.filter(plan => selection.planIds === null || selection.planIds.includes(plan.id)));
    const includedBaseIds = new Set(bases.map(base => base.id));
    const groupIds = new Set(bases.map(base => base.energyGroupId));
    for (const base of bases) {
        base.name = `${base.name.trim()} Copy`;
        for (const input of [...base.buildings, ...base.productions.flatMap(plan => plan.inputs ?? [])]) {
            if (input.linkedOutput && !includedBaseIds.has(input.linkedOutput.baseId)) detachLinkedOutput(input);
        }
    }
    for (const plan of plans) plan.name = `${plan.name.trim()} Copy`;
    return { ...archive, bases, plans, energyGroups: copy(archive.energyGroups.filter(group => groupIds.has(group.id))) };
}

function detachLinkedOutput(input: BaseBuilding) {
    if (!input.linkedOutput) return;
    input.selectedItemId = input.linkedOutput.itemIdSnapshot ?? input.selectedItemId;
    input.ratePerMinute = input.linkedOutput.ratePerMinuteSnapshot ?? input.ratePerMinute;
    delete input.linkedOutput;
}

function check(condition: unknown, message = 'The file contains invalid or incomplete planner data.'): asserts condition {
    if (!condition) throw new Error(message);
}
function object(value: unknown): asserts value is Record<string, unknown> {
    check(typeof value === 'object' && value !== null && !Array.isArray(value));
}
const string = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown) => number(value) && value > 0;
const nonnegative = (value: unknown) => number(value) && value >= 0;
function optional(entry: Record<string, unknown>, key: string, validate: (value: unknown) => void) {
    if (entry[key] !== undefined) validate(entry[key]);
}
function ids(value: unknown): asserts value is Record<string, unknown>[] {
    check(Array.isArray(value));
    const seen = new Set<string>();
    for (const entry of value) {
        object(entry);
        check(string(entry.id) && !seen.has(entry.id), 'The file contains missing or duplicate IDs.');
        seen.add(entry.id);
    }
}
function recipes(value: unknown) {
    object(value);
    check(Object.entries(value).every(([id, key]) => string(id) && string(key)));
}
function corporation(value: unknown) {
    if (value === null) return;
    object(value);
    check(string(value.corporationId) && number(value.level) && Number.isInteger(value.level) && value.level >= 0);
}
function building(value: unknown) {
    object(value);
    check(string(value.id) && string(value.buildingTypeId) && string(value.sectionType));
    for (const key of ['selectedItemId', 'sourceProductionId', 'planningOwnerPlanId', 'name', 'description']) {
        optional(value, key, item => check(typeof item === 'string'));
    }
    for (const key of ['ratePerMinute', 'requestedRatePerMinute', 'capacityPerMinute']) {
        optional(value, key, item => check(nonnegative(item)));
    }
    optional(value, 'priority', item => check(number(item)));
    optional(value, 'allocationMode', item => check(item === 'auto' || item === 'fixed'));
    optional(value, 'linkedOutput', item => {
        object(item);
        check(string(item.baseId) && string(item.buildingId));
        optional(item, 'itemIdSnapshot', id => check(typeof id === 'string'));
        optional(item, 'ratePerMinuteSnapshot', rate => check(nonnegative(rate)));
    });
}

/** Import is strict and atomic: never silently discard malformed records. */
export function parseArchive(text: string): PlannerArchive {
    check(text.length <= MAX_ARCHIVE_BYTES, 'Choose an export smaller than 20 MB.');
    let value: unknown;
    try {
        value = JSON.parse(text.replace(/^\uFEFF/, ''), (key, entry: unknown) => {
            check(!['__proto__', 'prototype', 'constructor'].includes(key), 'The file contains an unsupported property.');
            return entry;
        });
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('This is not a valid JSON file. Choose a Rupture Planner export.');
        throw error;
    }
    object(value);
    check(value.format === 'rupture-planner', 'Choose a file exported from Rupture Planner.');
    check(value.version === 1, 'This export version is not supported. Update Rupture Planner and try again.');
    check(string(value.dataVersion));
    check(value.basesMode === null || value.basesMode === 'planning' || value.basesMode === 'advanced');
    ids(value.bases);
    ids(value.plans);
    ids(value.energyGroups);
    check(value.bases.length + value.plans.length > 0, 'This file contains no bases or planner plans.');
    for (const group of value.energyGroups) check(string(group.name));
    for (const base of value.bases) {
        check(string(base.name));
        optional(base, 'coreLevel', level => check(number(level) && Number.isInteger(level) && level >= 0 && level <= 7));
        optional(base, 'energyGroupId', id => check(string(id)));
        ids(base.buildings);
        base.buildings.forEach(building);
        ids(base.productions);
        for (const plan of base.productions) {
            check(string(plan.name) && string(plan.selectedItemId) && positive(plan.targetAmount));
            optional(plan, 'active', active => check(typeof active === 'boolean'));
            optional(plan, 'status', status => check(typeof status === 'string' && ['active', 'inactive', 'error'].includes(status)));
            optional(plan, 'corporationLevel', corporation);
            optional(plan, 'recipeSelections', recipes);
            optional(plan, 'inputs', inputs => { ids(inputs); inputs.forEach(building); });
            optional(plan, 'requiredBuildings', required => {
                check(Array.isArray(required));
                for (const entry of required) {
                    object(entry);
                    check(string(entry.buildingId) && nonnegative(entry.count));
                }
            });
        }
    }
    for (const plan of value.plans) {
        check(string(plan.name) && (plan.mode === 'single' || plan.mode === 'multi'));
        check(plan.selectedItemId === null || string(plan.selectedItemId));
        corporation(plan.selectedCorporationLevel);
        check(positive(plan.targetAmount));
        recipes(plan.recipeSelections);
        check(typeof plan.groupByStage === 'boolean');
        check(typeof plan.flowDirection === 'string' && ['LR', 'RL', 'TB', 'BT'].includes(plan.flowDirection));
        check(plan.activeView === 'graph' || plan.activeView === 'table');
        check(Array.isArray(plan.multiTargets));
        const targets = new Set<string>();
        for (const target of plan.multiTargets) {
            object(target);
            check(string(target.itemId) && positive(target.amount) && !targets.has(target.itemId));
            targets.add(target.itemId);
        }
    }
    return value as unknown as PlannerArchive;
}

/** A fresh ID namespace ensures copies never reconnect to the user's originals. */
export function prepareArchiveImport(archive: PlannerArchive, prefix: string): PlannerArchive {
    const result = copy(archive);
    let sequence = 0;
    const nextId = () => `${prefix}-${++sequence}`;
    const baseIds = new Map(result.bases.map(base => [base.id, nextId()]));
    const groupIds = new Map(result.energyGroups.map(group => [group.id, nextId()]));
    const buildingIds = new Map(result.bases.map(base => [base.id, new Map(
        [...base.buildings, ...base.productions.flatMap(plan => plan.inputs ?? [])].map(entry => [entry.id, nextId()]),
    )]));
    for (const base of result.bases) {
        const planIds = new Map(base.productions.map(plan => [plan.id, nextId()]));
        const remapBuilding = (entry: BaseBuilding) => {
            entry.id = buildingIds.get(base.id)!.get(entry.id)!;
            if (entry.sourceProductionId) entry.sourceProductionId = planIds.get(entry.sourceProductionId);
            if (entry.planningOwnerPlanId) entry.planningOwnerPlanId = planIds.get(entry.planningOwnerPlanId);
            if (!entry.linkedOutput) return;
            const reference = entry.linkedOutput;
            const sourceBase = archive.bases.find(source => source.id === reference.baseId);
            const outputExists = sourceBase?.buildings.some(output => output.id === reference.buildingId && output.sectionType === 'outputs');
            if (outputExists) {
                reference.buildingId = buildingIds.get(reference.baseId)!.get(reference.buildingId)!;
                reference.baseId = baseIds.get(reference.baseId)!;
            } else {
                detachLinkedOutput(entry);
            }
        };
        base.buildings.forEach(remapBuilding);
        for (const plan of base.productions) {
            plan.id = planIds.get(plan.id)!;
            plan.inputs?.forEach(remapBuilding);
        }
        if (base.energyGroupId) base.energyGroupId = groupIds.get(base.energyGroupId);
        base.id = baseIds.get(base.id)!;
    }
    result.energyGroups.forEach(group => { group.id = groupIds.get(group.id)!; });
    result.plans.forEach(plan => { plan.id = nextId(); });
    return result;
}
