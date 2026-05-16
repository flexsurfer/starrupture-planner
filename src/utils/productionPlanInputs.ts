import type { Base, BaseBuilding, PlanRequiredBuilding } from '../state/db';
import type { ProductionFlowResult } from '../components/planner/core/types';

export type LinkedOutputStatus = 'ok' | 'missing-base' | 'missing-output' | 'unconfigured-output';

export interface LinkedOutputResolution {
    status: LinkedOutputStatus;
    sourceBase?: Base;
    sourceOutput?: BaseBuilding;
}

export interface ResolvedInputBuilding extends BaseBuilding {
    linkedOutputStatus?: LinkedOutputStatus;
}

export function getProductionInputIds(inputs: BaseBuilding[] | undefined): string[] {
    if (!inputs || inputs.length === 0) return [];
    return inputs
        .map((input) => input.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function buildBasesById(bases: Base[] | undefined): Map<string, Base> {
    return new Map((bases || []).map((base) => [base.id, base]));
}

type BaseLookup = Map<string, Base> | Base[] | undefined;

function lookupBase(lookup: BaseLookup, baseId: string): Base | undefined {
    if (!lookup) return undefined;
    if (lookup instanceof Map) return lookup.get(baseId);
    return lookup.find((base) => base.id === baseId);
}

export function resolveLinkedOutput(
    input: Pick<BaseBuilding, 'linkedOutput'>,
    bases: BaseLookup
): LinkedOutputResolution {
    const reference = input.linkedOutput;
    if (!reference) return { status: 'unconfigured-output' };

    const sourceBase = lookupBase(bases, reference.baseId);
    if (!sourceBase) return { status: 'missing-base' };

    const sourceOutput = sourceBase.buildings.find((building) => building.id === reference.buildingId);
    if (!sourceOutput || sourceOutput.sectionType !== 'outputs') {
        return { status: 'missing-output', sourceBase };
    }

    if (!sourceOutput.selectedItemId || !sourceOutput.ratePerMinute || sourceOutput.ratePerMinute <= 0) {
        return { status: 'unconfigured-output', sourceBase, sourceOutput };
    }

    return { status: 'ok', sourceBase, sourceOutput };
}

export function resolveInputBuilding(input: BaseBuilding, bases: BaseLookup): ResolvedInputBuilding {
    if (!input.linkedOutput) return input;

    const resolution = resolveLinkedOutput(input, bases);
    const fallbackItemId = input.linkedOutput.itemIdSnapshot || input.selectedItemId;
    const fallbackRatePerMinute = input.linkedOutput.ratePerMinuteSnapshot || input.ratePerMinute;

    if (resolution.status !== 'ok' || !resolution.sourceOutput) {
        return {
            ...input,
            selectedItemId: fallbackItemId,
            ratePerMinute: fallbackRatePerMinute,
            linkedOutputStatus: resolution.status,
        };
    }

    return {
        ...input,
        selectedItemId: resolution.sourceOutput.selectedItemId,
        ratePerMinute: resolution.sourceOutput.ratePerMinute,
        linkedOutputStatus: 'ok',
    };
}

export function getInputAvailabilityKey(input: BaseBuilding, baseId: string): string {
    if (input.linkedOutput) {
        return `linked-output:${input.linkedOutput.baseId}:${input.linkedOutput.buildingId}`;
    }

    return `manual-input:${baseId}:${input.id}`;
}

export function getFlowInputBuildings(inputs: BaseBuilding[] | undefined, bases?: BaseLookup): BaseBuilding[] {
    if (!inputs || inputs.length === 0) return [];

    return inputs
        .map((input) => resolveInputBuilding(input, bases))
        .filter((input) =>
            input.sectionType === 'inputs' &&
            !!input.selectedItemId &&
            !!input.ratePerMinute &&
            input.ratePerMinute > 0 &&
            (!input.linkedOutput || input.linkedOutputStatus === 'ok')
        );
}

export function getSelectedFlowInputBuildings(
    base: Base | null | undefined,
    selectedInputIds: string[],
    allBases?: BaseLookup
): BaseBuilding[] {
    if (!base || !selectedInputIds || selectedInputIds.length === 0) return [];
    const selectedIds = new Set(selectedInputIds);
    return getFlowInputBuildings(base.buildings.filter((building) => selectedIds.has(building.id)), allBases);
}

export function computeRequiredBuildings(flow: ProductionFlowResult): PlanRequiredBuilding[] {
    const map = new Map<string, PlanRequiredBuilding>();
    flow.nodes.forEach((node) => {
        if (node.nodeType === 'input') return;
        const existing = map.get(node.buildingId);
        if (existing) {
            existing.count += Math.ceil(node.buildingCount);
        } else {
            map.set(node.buildingId, {
                buildingId: node.buildingId,
                count: Math.ceil(node.buildingCount),
            });
        }
    });
    return Array.from(map.values());
}

/**
 * Drops recipe overrides for items already supplied by selected base inputs,
 * so the flow does not try to optimize production for what is external supply.
 */
export function sanitizeRecipeSelectionsForInputItems(
    recipeSelections: Record<string, string> | undefined,
    inputBuildings: ReadonlyArray<Pick<BaseBuilding, 'selectedItemId'>> = []
): Record<string, string> {
    const sanitized = { ...(recipeSelections || {}) };
    const inputItemIds = new Set(
        inputBuildings
            .map((input) => input.selectedItemId)
            .filter((id): id is string => !!id)
    );
    inputItemIds.forEach((itemId) => {
        delete sanitized[itemId];
    });
    return sanitized;
}
