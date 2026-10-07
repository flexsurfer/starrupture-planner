import type { Base, BaseBuilding, Building, BuildingsByIdMap, Item } from '@/app/uklad/model';
import { resolveInputBuilding } from '@/utils/productionPlanInputs';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import { PACKAGE_DISPATCHER_BUILDING_ID, PACKAGE_RECEIVER_BUILDING_ID } from '@/constants/buildingIds';
import { isDroneTransport } from './building-section';
import type { BuildingConnection, ConnectionReference, LinkableInputItem, LinkableOutputItem, LinkedInputReference } from './types';

export function getConnectionPairs(entry: LinkableInputItem | LinkableOutputItem): BuildingConnection[] {
    if ('baseBuildingId' in entry) {
        const source = { baseId: entry.baseId, buildingId: entry.baseBuildingId };
        return entry.connections.map(target => ({ source, target }));
    }
    const target = { baseId: entry.baseId, buildingId: entry.buildingId };
    return entry.connections.map(source => ({ source, target }));
}

export function getMatchingInputBuildingTypeId(output: Building | undefined): string | undefined {
    if (output?.id === PACKAGE_DISPATCHER_BUILDING_ID) return PACKAGE_RECEIVER_BUILDING_ID;
    return output && (output.type === 'storage' || isDroneTransport(output)) ? output.id : undefined;
}

export function supportsOutputLink(input: Building): boolean {
    return input.id === PACKAGE_RECEIVER_BUILDING_ID || input.type === 'storage' || isDroneTransport(input);
}

export function areConnectionTypesCompatible(output: Building | undefined, input: Building | undefined): boolean {
    if (output?.type === 'storage') return input?.type === 'storage';
    if (output && isDroneTransport(output)) return !!input && isDroneTransport(input);
    return !!input && getMatchingInputBuildingTypeId(output) === input.id;
}

/** Physical endpoints reserve outputs; saved plan snapshots do not create extra connections. */
export function getOutputConnections(bases: Base[], sourceBaseId: string, outputId: string) {
    return bases.flatMap(base => base.buildings
        .filter(input => input.sectionType === 'inputs' &&
            input.linkedOutput?.baseId === sourceBaseId && input.linkedOutput.buildingId === outputId)
        .map(input => ({ base, input })));
}

export function describeConnection(bases: Base[], buildingsById: BuildingsByIdMap, ref: LinkedInputReference, items?: Record<string, Item>): ConnectionReference {
    const base = bases.find(candidate => candidate.id === ref.baseId);
    const endpoint = base?.buildings.find(candidate => candidate.id === ref.buildingId);
    const resolved = items && endpoint ? (endpoint.sectionType === 'inputs'
        ? resolveInputBuilding(endpoint, bases) : resolveOutputBuilding(endpoint, base)) : undefined;
    const itemId = resolved?.selectedItemId;
    const planName = endpoint?.sectionType === 'outputs' && endpoint.sourceProductionId
        ? base?.productions.find(plan => plan.id === endpoint.sourceProductionId)?.name : undefined;
    return {
        baseId: ref.baseId,
        buildingId: ref.buildingId,
        baseName: base?.name || '',
        buildingName: endpoint?.name || (endpoint && buildingsById[endpoint.buildingTypeId]?.name) || ref.buildingId,
        ...(items && endpoint ? {
            building: buildingsById[endpoint.buildingTypeId],
            item: itemId ? items[itemId] || { id: itemId, name: itemId, type: 'unknown' } : undefined,
            ratePerMinute: resolved?.ratePerMinute,
            ...(planName ? { planName } : {}),
        } : {}),
    };
}

/** Validate both ends before any mutation, including requests from a stale picker. */
export function canConnectBuildings(
    bases: Base[], buildings: Building[], sourceBaseId: string, output: BaseBuilding,
    targetBaseId: string, input: BaseBuilding,
): boolean {
    if (output.sectionType !== 'outputs' || input.sectionType !== 'inputs') return false;
    if (!areConnectionTypesCompatible(
        buildings.find(building => building.id === output.buildingTypeId),
        buildings.find(building => building.id === input.buildingTypeId),
    )) return false;
    if (input.linkedOutput && (input.linkedOutput.baseId !== sourceBaseId || input.linkedOutput.buildingId !== output.id)) return false;
    return !getOutputConnections(bases, sourceBaseId, output.id)
        .some(({ base, input: connected }) => base.id !== targetBaseId || connected.id !== input.id);
}
