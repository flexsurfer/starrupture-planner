import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, BuildingsByIdMap, Item } from '@/app/uklad/model';
import { resolveInputBuilding } from '@/utils/productionPlanInputs';
import { collectConfiguredSectionItems } from './derived-subscriptions';
import { areConnectionTypesCompatible, describeConnection, getMatchingInputBuildingTypeId, getOutputConnections } from './connections';
import type { LinkableInputItem, LinkableOutputItem } from './types';

export function collectConnectionOutputs(bases: Base[], buildingsById: BuildingsByIdMap, items: Record<string, Item>, currentBaseId: string | null, inputTypeId: string | null): LinkableOutputItem[] {
    return bases.flatMap(base => collectConfiguredSectionItems(base, buildingsById, items, 'outputs')
        .filter(entry => inputTypeId
            ? areConnectionTypesCompatible(entry.building, buildingsById[inputTypeId])
            : !!getMatchingInputBuildingTypeId(entry.building))
        .map(entry => {
            const output = base.buildings.find(building => building.id === entry.baseBuildingId);
            return {
                ...entry, baseId: base.id, baseName: base.name, isCurrentBase: base.id === currentBaseId,
                planName: base.productions.find(plan => plan.id === output?.sourceProductionId)?.name,
                connections: getOutputConnections(bases, base.id, entry.baseBuildingId)
                    .map(({ base: target, input }) => describeConnection(bases, buildingsById, { baseId: target.id, buildingId: input.id }, items)),
            };
        }))
        .sort((a, b) => Number(b.isCurrentBase) - Number(a.isCurrentBase) || a.baseName.localeCompare(b.baseName) || a.item.name.localeCompare(b.item.name));
}

export function collectConnectionInputs(bases: Base[], buildingsById: BuildingsByIdMap, items: Record<string, Item>, currentBaseId: string | null, outputId: string | null, outputTypeId: string | null): LinkableInputItem[] {
    const targets: LinkableInputItem[] = [];
    for (const base of bases) {
        for (const input of base.buildings) {
            if (input.sectionType !== 'inputs') continue;
            const building = buildingsById[input.buildingTypeId];
            if (!building) continue;
            const isCurrent = !!outputId && input.linkedOutput?.baseId === currentBaseId && input.linkedOutput.buildingId === outputId;
            // Keep legacy connections visible so the user can disconnect them.
            if (!isCurrent && !areConnectionTypesCompatible(outputTypeId ? buildingsById[outputTypeId] : undefined, building)) continue;
            const resolved = resolveInputBuilding(input, bases);
            const itemId = resolved.selectedItemId;
            targets.push({
                key: `${base.id}:${input.id}`, baseId: base.id, buildingId: input.id, baseName: base.name,
                building, name: input.name || building.name,
                item: itemId ? items[itemId] || { id: itemId, name: itemId, type: 'unknown' } : undefined,
                ratePerMinute: resolved.ratePerMinute,
                connections: input.linkedOutput ? [describeConnection(bases, buildingsById, input.linkedOutput, items)] : [],
            });
        }
    }
    return targets.sort((a, b) => Number(b.baseId === currentBaseId) - Number(a.baseId === currentBaseId) || a.baseName.localeCompare(b.baseName) || a.name.localeCompare(b.name));
}

export const registerConnectionSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regSub(appIds.subscriptions.BASES_CONNECTION_BUILDING,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([bases, buildings, items], baseId, buildingId) => baseId && buildingId
            ? describeConnection(bases, buildings, { baseId, buildingId }, items) : null);
    registrar.regSub(appIds.subscriptions.BASES_CONNECTION_OUTPUTS,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([bases, buildings, items], baseId, inputTypeId) => collectConnectionOutputs(bases, buildings, items, baseId, inputTypeId));
    registrar.regSub(appIds.subscriptions.BASES_CONNECTION_INPUTS,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([bases, buildings, items], baseId, outputId, outputTypeId) => collectConnectionInputs(bases, buildings, items, baseId, outputId, outputTypeId));
};
