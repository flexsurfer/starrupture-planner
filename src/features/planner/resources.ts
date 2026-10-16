import type { Building, Item } from '@/app/uklad/model';
import type { SaveSnapshot } from '@/features/saves/snapshot';
import type { PlannerTab } from './state';
import type { PlannerProductionFlowResult } from './types';
import { getPlannerInputBuildings } from './external-inputs';
import { calculateMaxTargetFromInputs } from '@/utils/matchInputsCalculation';

export interface PlannerResource {
    id: string;
    itemId: string;
    ratePerMinute: number;
    enabled: boolean;
    /** Optional attribution only; save replacement/deletion never changes this allocation. */
    coreId?: number;
    coreName?: string;
}
export interface PlannerResourceSummary {
    itemId: string;
    name: string;
    rows: PlannerResource[];
    availableRate: number;
    usedRate: number;
    unusedRate: number;
    isTarget: boolean;
}
export interface PlannerResourcePickerBuilding {
    buildingId: number;
    buildingTypeId: string;
    buildingName: string;
    itemId: string;
    itemName: string;
    capacity: number | null;
    source: 'extraction' | 'delivery';
    isTarget: boolean;
}
export interface PlannerResourcePicker {
    workspaceId: string;
    snapshotKey: string;
    compatible: boolean;
    cores: { coreId: number; coreKey: string; name: string; buildings: PlannerResourcePickerBuilding[] }[];
}
export interface PlannerResourceSelection { buildingId: number; ratePerMinute?: number }
export interface PlannerCoreAllocation { coreId: number; coreName: string; itemId: string; ratePerMinute: number }
export interface PlannerResourceFit {
    available: boolean;
    reason: 'multi-target' | 'no-target' | 'no-resources' | 'unrelated-resources' | null;
    targetAmount: number | null;
}
export interface PlannerBuildingComparison {
    coreNames: string[];
    rows: { buildingTypeId: string; name: string; existing: number; planned: number; additional: number; spare: number }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
export const isValidResourceRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e9;
const fail = (): never => { throw new Error('Invalid planner resources'); };

/** Whitelist and detach persisted data. Strict mode is used by archive import. */
export function normalizePlannerResources(value: unknown, strict = false): PlannerResource[] {
    if (!Array.isArray(value) || value.length > 10000) { if (strict) fail(); return []; }
    const ids = new Set<string>();
    return value.flatMap(entry => {
        if (!isRecord(entry) || !validText(entry.id) || ids.has(entry.id) || !validText(entry.itemId)
            || !isValidResourceRate(entry.ratePerMinute) || typeof entry.enabled !== 'boolean') {
            if (strict) fail(); return [];
        }
        const row: PlannerResource = { id: entry.id, itemId: entry.itemId, ratePerMinute: entry.ratePerMinute, enabled: entry.enabled };
        if (entry.coreId !== undefined || entry.coreName !== undefined) {
            if (typeof entry.coreId !== 'number' || !Number.isSafeInteger(entry.coreId) || entry.coreId < 0 || entry.coreId >= 4294967295
                || !validText(entry.coreName)) {
                if (strict) fail(); return [];
            }
            row.coreId = entry.coreId;
            row.coreName = entry.coreName;
        }
        ids.add(row.id);
        return [row];
    });
}
/** Sum selected buildings before checking duplicates: identity belongs to the allocation. */
export function groupPlannerCoreAllocations(rows: PlannerCoreAllocation[]): PlannerCoreAllocation[] {
    const groups = new Map<string, PlannerCoreAllocation>();
    for (const row of rows) {
        const key = JSON.stringify([row.coreId, row.itemId]);
        const previous = groups.get(key);
        if (previous) previous.ratePerMinute += row.ratePerMinute;
        else groups.set(key, { ...row });
    }
    return [...groups.values()];
}
export function hasPlannerCoreAllocation(resources: PlannerResource[], allocation: PlannerCoreAllocation): boolean {
    return resources.some(row => row.coreId === allocation.coreId && row.itemId === allocation.itemId
        // Ignore only floating-point addition noise (e.g. 0.1 + 0.2 vs 0.3).
        && Math.abs(row.ratePerMinute - allocation.ratePerMinute) <= Number.EPSILON * Math.max(1, row.ratePerMinute, allocation.ratePerMinute) * 8);
}
export function resourcesFromLegacyInputs(value: unknown): PlannerResource[] {
    if (!isRecord(value)) return [];
    return Object.entries(value).filter(([itemId, rate]) => validText(itemId) && isValidResourceRate(rate))
        .map(([itemId, rate], index) => ({ id: `legacy-resource-${index + 1}`, itemId, ratePerMinute: rate as number, enabled: true }));
}
export function plannerTargetIds(tab: PlannerTab | null): string[] {
    return !tab ? [] : tab.mode === 'multi' ? tab.multiTargets.map(target => target.itemId) : tab.selectedItemId ? [tab.selectedItemId] : [];
}
export function aggregatePlannerResources(resources: PlannerResource[], targetIds: string[] = []): Record<string, number> {
    const targets = new Set(targetIds);
    const amounts = new Map<string, number>();
    for (const row of resources) if (row.enabled && !targets.has(row.itemId)) amounts.set(row.itemId, (amounts.get(row.itemId) ?? 0) + row.ratePerMinute);
    return Object.fromEntries(amounts);
}
export function nextPlannerResourceId(resources: PlannerResource[]): string {
    let index = 1;
    const used = new Set(resources.map(row => row.id));
    while (used.has(`resource-${index}`)) index++;
    return `resource-${index}`;
}
/** Non-security content fingerprint. Derived once per save change, never during rate edits. */
export function saveResourceSnapshotKey(snapshot: SaveSnapshot): string {
    const text = JSON.stringify(snapshot);
    let hash = 2166136261;
    let second = 5381;
    for (let index = 0; index < text.length; index++) { hash = Math.imul(hash ^ text.charCodeAt(index), 16777619); second = Math.imul(second, 33) ^ text.charCodeAt(index); }
    return `${text.length}:${hash >>> 0}:${second >>> 0}`;
}
export function buildPlannerResourceSummary(resources: PlannerResource[], targets: string[], flow: PlannerProductionFlowResult, items: Item[]): PlannerResourceSummary[] {
    const names = new Map(items.map(item => [item.id, item.name]));
    const used = new Map<string, number>();
    for (const node of flow.nodes) if (node.nodeType === 'input') used.set(node.outputItem, (used.get(node.outputItem) ?? 0) + node.outputAmount * node.buildingCount);
    const grouped = new Map<string, PlannerResource[]>();
    for (const row of resources) grouped.set(row.itemId, [...(grouped.get(row.itemId) ?? []), row]);
    return [...grouped].map(([itemId, rows]) => {
        const availableRate = rows.reduce((total, row) => total + (row.enabled ? row.ratePerMinute : 0), 0);
        const usedRate = Math.min(availableRate, used.get(itemId) ?? 0);
        return { itemId, name: names.get(itemId) ?? itemId, rows, availableRate, usedRate, unusedRate: Math.max(0, availableRate - usedRate), isTarget: targets.includes(itemId) };
    }).sort((a, b) => a.name.localeCompare(b.name));
}
export function getPlannerResourceFit(tab: PlannerTab | null, buildings: Building[]): PlannerResourceFit {
    const unavailable = (reason: PlannerResourceFit['reason']): PlannerResourceFit => ({ available: false, reason, targetAmount: null });
    if (!tab?.selectedItemId && tab?.mode !== 'multi') return unavailable('no-target');
    if (tab?.mode === 'multi') return unavailable('multi-target');
    if (!tab?.selectedItemId) return unavailable('no-target');
    const amounts = aggregatePlannerResources(tab.resources, plannerTargetIds(tab));
    if (!Object.keys(amounts).length) return unavailable('no-resources');
    const inputBuildings = getPlannerInputBuildings(amounts);
    const targetAmount = calculateMaxTargetFromInputs({ selectedItemId: tab.selectedItemId, inputBuildings, buildings,
        includeLauncher: tab.selectedCorporationLevel !== null, recipeSelections: tab.recipeSelections });
    if (targetAmount === null) return unavailable('unrelated-resources');
    return { available: true, reason: null, targetAmount };
}
