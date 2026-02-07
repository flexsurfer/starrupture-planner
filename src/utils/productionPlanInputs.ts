import type { Base, BaseBuilding } from '../state/db';

export function getProductionInputIds(inputs: BaseBuilding[] | undefined): string[] {
    if (!inputs || inputs.length === 0) return [];
    return inputs
        .map((input) => input.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function getFlowInputBuildings(inputs: BaseBuilding[] | undefined): BaseBuilding[] {
    if (!inputs || inputs.length === 0) return [];

    return inputs.filter((input) =>
        input.sectionType === 'inputs' &&
        !!input.selectedItemId &&
        !!input.ratePerMinute &&
        input.ratePerMinute > 0
    );
}

export function getSelectedFlowInputBuildings(
    base: Base | null | undefined,
    selectedInputIds: string[]
): BaseBuilding[] {
    if (!base || !selectedInputIds || selectedInputIds.length === 0) return [];
    const selectedIds = new Set(selectedInputIds);
    return getFlowInputBuildings(base.buildings.filter((building) => selectedIds.has(building.id)));
}
