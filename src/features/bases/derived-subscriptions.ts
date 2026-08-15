import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, Building, BuildingsByIdMap, EnergyGroup, Item, Production } from '@/state/db';
import type {
    BaseDefenseBuilding,
    BaseDetailStats,
    BuildingCoverageRow,
    BuildingSectionBuilding,
    BuildingSectionStats,
    MaterialBalanceRow,
    MyBasesStats,
    PlanSummaryRow,
} from '@/components/mybases/types';
import { calculateBaseCoreHeatCapacity, getCoreLevels, isAmplifierBuilding } from '@/components/mybases/utils/baseCoreUtils';
import { getAvailableBuildingsForSection, isBuildingAvailableForSection } from '@/components/mybases/utils/buildingSectionUtils';
import { buildActivePlanOccupancy } from '@/components/mybases/utils/activePlanOccupancy';
import { buildAllBaseLogisticsViewModels, buildBaseLogisticsViewModel } from '@/components/mybases/utils/logistics';
import { getFlowInputBuildings, resolveInputBuilding, resolveLinkedOutput } from '@/utils/productionPlanInputs';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import type { LinkedOutputStatus } from '@/utils/productionPlanInputs';
import { buildProductionFlow } from '@/components/planner/core/productionFlowBuilder';

interface ConfiguredSectionItem {
    baseBuildingId: string;
    item: Item;
    ratePerMinute: number;
    building: Building;
    name: string;
    description: string;
    linkedOutput?: { status: LinkedOutputStatus; baseId: string; buildingId: string; baseName: string; outputName: string };
}

export function collectConfiguredSectionItems(base: Base, buildingsById: BuildingsByIdMap, itemsById: Record<string, Item>, sectionType: 'inputs' | 'outputs', allBases: Base[] = [base]): ConfiguredSectionItem[] {
    const items: ConfiguredSectionItem[] = [];
    for (const baseBuilding of base.buildings) {
        if (baseBuilding.sectionType !== sectionType) continue;
        const resolvedBuilding = sectionType === 'inputs'
            ? resolveInputBuilding(baseBuilding, allBases)
            : resolveOutputBuilding(baseBuilding, base);
        const itemId = resolvedBuilding.selectedItemId ?? baseBuilding.linkedOutput?.itemIdSnapshot;
        const ratePerMinute = resolvedBuilding.ratePerMinute ?? baseBuilding.linkedOutput?.ratePerMinuteSnapshot;
        const hasRate = typeof ratePerMinute === 'number' && Number.isFinite(ratePerMinute);
        const includeZeroRateOutput = sectionType === 'outputs' && !!baseBuilding.sourceProductionId && hasRate;
        if (!itemId || (!(hasRate && ratePerMinute > 0) && !includeZeroRateOutput)) continue;

        const building = buildingsById[resolvedBuilding.buildingTypeId];
        if (!building) continue;
        const item = itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' };
        const linkedResolution = baseBuilding.linkedOutput ? resolveLinkedOutput(baseBuilding, allBases) : null;
        const sourceBuilding = linkedResolution?.sourceOutput
            ? buildingsById[linkedResolution.sourceOutput.buildingTypeId]
            : null;
        items.push({
            baseBuildingId: baseBuilding.id,
            item,
            ratePerMinute,
            building,
            name: baseBuilding.name || building.name || item.name,
            description: baseBuilding.description || '',
            linkedOutput: baseBuilding.linkedOutput ? {
                status: linkedResolution?.status || 'missing-output',
                baseId: baseBuilding.linkedOutput.baseId,
                buildingId: baseBuilding.linkedOutput.buildingId,
                baseName: linkedResolution?.sourceBase?.name || 'Missing base',
                outputName: linkedResolution?.sourceOutput?.name || sourceBuilding?.name || baseBuilding.linkedOutput.buildingId,
            } : undefined,
        });
    }
    return items;
}

function calculateBaseDetailStats(base: Base, buildingsById: BuildingsByIdMap, energyGroupsById?: Record<string, EnergyGroup>, allBases?: Base[]): BaseDetailStats {
    let totalHeat = 0;
    let localGeneration = 0;
    let localConsumption = 0;
    for (const baseBuilding of base.buildings) {
        const building = buildingsById[baseBuilding.buildingTypeId];
        if (!building) continue;
        totalHeat += building.heat || 0;
        if (building.type === 'generator') localGeneration += building.power || 0;
        else localConsumption += building.power || 0;
    }
    let pooledGeneration: number | null = null;
    let pooledConsumption: number | null = null;
    if (base.energyGroupId && energyGroupsById?.[base.energyGroupId] && allBases) {
        pooledGeneration = 0;
        pooledConsumption = 0;
        for (const groupBase of allBases) {
            if (groupBase.energyGroupId !== base.energyGroupId) continue;
            for (const baseBuilding of groupBase.buildings) {
                const building = buildingsById[baseBuilding.buildingTypeId];
                if (!building) continue;
                if (building.type === 'generator') pooledGeneration += building.power || 0;
                else pooledConsumption += building.power || 0;
            }
        }
    }
    const energyGeneration = pooledGeneration ?? localGeneration;
    const energyGridConsumption = pooledConsumption ?? localConsumption;
    const baseCoreHeatCapacity = calculateBaseCoreHeatCapacity(base.coreLevel ?? 0, base.buildings, buildingsById);
    const energyPercentage = energyGeneration > 0
        ? Math.min((localConsumption / energyGeneration) * 100, 100)
        : localConsumption > 0 ? 100 : 0;
    return {
        baseName: base.name,
        coreLevel: base.coreLevel ?? 0,
        buildingCount: base.buildings.length,
        totalHeat,
        energyGeneration,
        energyConsumption: localConsumption,
        localEnergyGeneration: localGeneration,
        energyGridConsumption,
        baseCoreHeatCapacity,
        heatPercentage: Math.min((totalHeat / baseCoreHeatCapacity) * 100, 100),
        energyPercentage,
        isHeatOverCapacity: totalHeat > baseCoreHeatCapacity,
        isEnergyInsufficient: localConsumption > 0 && (energyGeneration === 0 || localConsumption > energyGeneration),
        energyGroupId: base.energyGroupId,
        energyGroupName: base.energyGroupId && energyGroupsById ? energyGroupsById[base.energyGroupId]?.name : undefined,
    };
}

function derivePlanStatus(plan: Production): PlanSummaryRow['status'] {
    return plan.status === 'active' || plan.status === 'inactive' || plan.status === 'error'
        ? plan.status
        : plan.active ? 'active' : 'inactive';
}

function comparePlanSummaryRows(left: PlanSummaryRow, right: PlanSummaryRow): number {
    const weight = { active: 0, error: 1, inactive: 2 } as const;
    return weight[left.status] - weight[right.status]
        || left.itemName.localeCompare(right.itemName)
        || left.name.localeCompare(right.name);
}

export const registerBasesDerivedSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regSub(appIds.subscriptions.BASES_SELECTED_BASE_DETAIL_STATS,
        () => [[appIds.subscriptions.BASES_SELECTED_BASE], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP], [appIds.subscriptions.BASES_LIST]],
        ([base, buildingsById, groupsById, bases], ..._params) => (void _params, base ? calculateBaseDetailStats(base, buildingsById, groupsById, bases) : null));

    registrar.regSub(appIds.subscriptions.BASES_CORE_LEVELS,
        () => [[appIds.subscriptions.BUILDINGS_BY_ID_MAP]],
        ([buildingsById], ..._params) => (void _params, getCoreLevels(buildingsById)));

    registrar.regSub(appIds.subscriptions.BASES_DETAIL_STATS_BY_BASE_ID,
        () => [[appIds.subscriptions.BASES_BY_ID_MAP], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP], [appIds.subscriptions.BASES_LIST]],
        ([basesById, buildingsById, groupsById, bases], baseId) => {
            const base = basesById[baseId];
            return base ? calculateBaseDetailStats(base, buildingsById, groupsById, bases) : null;
        });

    registrar.regSub(appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([bases, buildingsById, itemsById], baseId) => buildBaseLogisticsViewModel({ selectedBaseId: baseId, bases, buildingsById, itemsById }));

    registrar.regSub(appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([bases, buildingsById, itemsById], ..._params) => (void _params, buildAllBaseLogisticsViewModels({ bases, buildingsById, itemsById })));

    registrar.regSub(appIds.subscriptions.BASES_ALL_DETAIL_STATS,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP]],
        ([bases, buildingsById, groupsById], ..._params) => (void _params, Object.fromEntries(bases.map((base) => [base.id, calculateBaseDetailStats(base, buildingsById, groupsById, bases)]))));

    registrar.regSub(appIds.subscriptions.BASES_INPUT_ITEMS_BY_BASE_ID,
        () => [[appIds.subscriptions.BASES_BY_ID_MAP], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP], [appIds.subscriptions.BASES_LIST]],
        ([basesById, buildingsById, itemsById, bases], baseId) => {
            const base = basesById[baseId];
            return base ? collectConfiguredSectionItems(base, buildingsById, itemsById, 'inputs', bases) : [];
        });

    registrar.regSub(appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID,
        () => [[appIds.subscriptions.BASES_BY_ID_MAP], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([basesById, buildingsById, itemsById], baseId) => {
            const base = basesById[baseId];
            return base ? collectConfiguredSectionItems(base, buildingsById, itemsById, 'outputs') : [];
        });

    registrar.regSub(appIds.subscriptions.BASES_DEFENSE_BUILDINGS_BY_BASE_ID,
        () => [[appIds.subscriptions.BASES_BY_ID_MAP], [appIds.subscriptions.BUILDINGS_BY_ID_MAP]],
        ([basesById, buildingsById], baseId) => {
            const base = basesById[baseId];
            if (!base) return [];
            const defenseByType = new Map<string, BaseDefenseBuilding>();
            for (const baseBuilding of base.buildings) {
                const building = buildingsById[baseBuilding.buildingTypeId];
                if (!building || building.type !== 'defense') continue;
                const existing = defenseByType.get(building.id);
                if (existing) existing.count += 1;
                else defenseByType.set(building.id, { building, count: 1 });
            }
            return Array.from(defenseByType.values());
        });

    registrar.regSub(appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS,
        (baseId, _sectionType) => (void _sectionType, [[appIds.subscriptions.BASES_BASE_BY_ID, baseId], [appIds.subscriptions.BUILDINGS_BY_ID_MAP]]),
        ([base, buildingsById], _baseId, sectionType) => {
            if (!base) return [];
            const sectionBuildings = base.buildings.filter((building) => building.sectionType === sectionType);
            if (sectionBuildings.length === 0) return [];
            const activePlansById = new Map(base.productions.filter((plan) => plan.active).map((plan) => [plan.id, plan]));
            const planNamesByBuildingId = new Map<string, Set<string>>();
            const addPlanName = (buildingId: string, planName: string) => {
                if (!buildingId || !planName) return;
                const names = planNamesByBuildingId.get(buildingId) || new Set<string>();
                names.add(planName);
                planNamesByBuildingId.set(buildingId, names);
            };
            buildActivePlanOccupancy(base).assignedPlanBuildingIds.forEach((buildingIds, planId) => {
                const planName = activePlansById.get(planId)?.name;
                if (planName) buildingIds.forEach((buildingId) => addPlanName(buildingId, planName));
            });
            const baseBuildingIds = new Set(base.buildings.map((building) => building.id));
            for (const plan of base.productions.filter((candidate) => candidate.active)) {
                for (const input of plan.inputs || []) {
                    if (input.id && baseBuildingIds.has(input.id)) addPlanName(input.id, plan.name);
                }
            }
            const entries = sectionBuildings.flatMap((baseBuilding): BuildingSectionBuilding[] => {
                const building = buildingsById[baseBuilding.buildingTypeId];
                return building ? [{
                    id: baseBuilding.id,
                    buildingTypeId: baseBuilding.buildingTypeId,
                    sectionType,
                    baseBuilding,
                    building,
                    count: 1,
                    isGrouped: false,
                    activePlanNames: Array.from(planNamesByBuildingId.get(baseBuilding.id) || []),
                }] : [];
            });
            if (sectionType !== 'energy' && sectionType !== 'production') return entries;
            const grouped = new Map<string, Omit<BuildingSectionBuilding, 'baseBuilding'>>();
            for (const entry of entries) {
                const existing = grouped.get(entry.buildingTypeId);
                if (existing) {
                    existing.count += 1;
                    existing.activePlanNames = Array.from(new Set([...existing.activePlanNames, ...entry.activePlanNames]));
                } else {
                    grouped.set(entry.buildingTypeId, {
                        id: `${sectionType}:${entry.buildingTypeId}`,
                        buildingTypeId: entry.buildingTypeId,
                        sectionType,
                        building: entry.building,
                        count: 1,
                        isGrouped: true,
                        activePlanNames: [...entry.activePlanNames],
                    });
                }
            }
            return Array.from(grouped.values());
        });

    registrar.regSub(appIds.subscriptions.BASES_BUILDING_SECTION_STATS,
        () => [[appIds.subscriptions.BASES_BY_ID_MAP], [appIds.subscriptions.BUILDINGS_BY_ID_MAP]],
        ([basesById, buildingsById], baseId, sectionType) => {
            const baseBuildings = basesById[baseId]?.buildings.filter((building) => building.sectionType === sectionType) || [];
            const stats: BuildingSectionStats = { buildingCount: baseBuildings.length, totalHeat: 0, totalPowerGeneration: 0, totalPowerConsumption: 0, hasGenerators: false };
            for (const baseBuilding of baseBuildings) {
                const building = buildingsById[baseBuilding.buildingTypeId];
                if (!building) continue;
                if (!isAmplifierBuilding(building.id)) stats.totalHeat += building.heat || 0;
                if (building.type === 'generator') {
                    stats.hasGenerators = true;
                    stats.totalPowerGeneration += building.power || 0;
                } else stats.totalPowerConsumption += building.power || 0;
            }
            return stats;
        });

    registrar.regSub(appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION,
        () => [[appIds.subscriptions.BUILDINGS_LIST]],
        ([buildings], sectionType) => getAvailableBuildingsForSection(buildings, sectionType));

    registrar.regSub(appIds.subscriptions.BASES_STATS_SUMMARY,
        () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP]],
        ([bases, buildingsById], ..._params) => {
            void _params;
            const summary: MyBasesStats = { totalBases: bases.length, totalBuildings: 0, totalPlans: 0, totalHeat: 0, totalHeatCapacity: 0, totalEnergyUsed: 0, totalEnergyProduced: 0, heatPercentage: 0, energyPercentage: 0, isHeatOverCapacity: false, isEnergyInsufficient: false };
            for (const base of bases) {
                summary.totalBuildings += base.buildings.length;
                summary.totalPlans += base.productions.length;
                summary.totalHeatCapacity += calculateBaseCoreHeatCapacity(base.coreLevel ?? 0, base.buildings, buildingsById);
                for (const baseBuilding of base.buildings) {
                    const building = buildingsById[baseBuilding.buildingTypeId];
                    if (!building) continue;
                    if (!isAmplifierBuilding(building.id)) summary.totalHeat += building.heat || 0;
                    if (building.type === 'generator') summary.totalEnergyProduced += building.power || 0;
                    else summary.totalEnergyUsed += building.power || 0;
                }
            }
            summary.heatPercentage = summary.totalHeatCapacity > 0 ? Math.min((summary.totalHeat / summary.totalHeatCapacity) * 100, 100) : 0;
            summary.energyPercentage = summary.totalEnergyProduced > 0 ? Math.min((summary.totalEnergyUsed / summary.totalEnergyProduced) * 100, 100) : summary.totalEnergyUsed > 0 ? 100 : 0;
            summary.isHeatOverCapacity = summary.totalHeat > summary.totalHeatCapacity;
            summary.isEnergyInsufficient = summary.totalEnergyUsed > 0 && (summary.totalEnergyProduced === 0 || summary.totalEnergyUsed > summary.totalEnergyProduced);
            return summary;
        });

    registrar.regSub(appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS,
        () => [[appIds.subscriptions.BASES_SELECTED_BASE], [appIds.subscriptions.CORPORATIONS_LIST], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([base, corporations, itemsById], ..._params) => {
            void _params;
            if (!base) return [];
            const names = new Map(corporations.map((corporation) => [corporation.id, corporation.name]));
            return base.productions.map((plan) => ({
                id: plan.id, name: plan.name, selectedItemId: plan.selectedItemId,
                targetItem: itemsById[plan.selectedItemId] || null,
                itemName: itemsById[plan.selectedItemId]?.name || plan.selectedItemId,
                targetAmount: plan.targetAmount, status: derivePlanStatus(plan),
                requiredBuildingCount: (plan.requiredBuildings || []).reduce((sum, building) => sum + building.count, 0),
                inputCount: (plan.inputs || []).length,
                corporationLabel: plan.corporationLevel
                    ? `${names.get(plan.corporationLevel.corporationId) || 'Corporation'} Lv.${plan.corporationLevel.level}` : 'None',
            })).sort(comparePlanSummaryRows);
        });

    registrar.regSub(appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS,
        () => [[appIds.subscriptions.BASES_SELECTED_BASE], [appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_LIST], [appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([base, bases, buildings, itemsById], ..._params) => {
            void _params;
            if (!base) return [];
            const coverage = new Map<string, number>();
            for (const input of base.buildings) {
                if (input.sectionType !== 'inputs') continue;
                const resolved = resolveInputBuilding(input, bases);
                if (resolved.linkedOutput && resolved.linkedOutputStatus !== 'ok') continue;
                if (resolved.selectedItemId && resolved.ratePerMinute && resolved.ratePerMinute > 0) {
                    coverage.set(resolved.selectedItemId, (coverage.get(resolved.selectedItemId) || 0) + resolved.ratePerMinute);
                }
            }
            const rows = new Map<string, MaterialBalanceRow>();
            const rawKeys = new Set<string>();
            const add = (planId: string, itemId: string, required: number) => {
                const existing = rows.get(itemId);
                if (existing) { existing.perPlan[planId] = (existing.perPlan[planId] || 0) + required; existing.totalRequired += required; return; }
                rows.set(itemId, { itemId, item: itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' }, perPlan: { [planId]: required }, totalRequired: required, covered: 0, available: 0, missing: 0 });
            };
            for (const plan of base.productions) {
                if (!plan.selectedItemId || plan.targetAmount <= 0) continue;
                const flow = buildProductionFlow({ targetItemId: plan.selectedItemId, targetAmount: plan.targetAmount, inputBuildings: getFlowInputBuildings(plan.inputs || [], bases), rawProductionDisabled: true, includeLauncher: plan.corporationLevel !== null && plan.corporationLevel !== undefined, recipeSelections: plan.recipeSelections || {} }, buildings);
                for (const deficit of flow.rawMaterialDeficits || []) { rawKeys.add(`${plan.id}:${deficit.itemId}`); add(plan.id, deficit.itemId, deficit.required); }
                const inputRequirements = new Map<string, number>();
                for (const node of flow.nodes) {
                    if (node.nodeType !== 'input' || !node.outputItem || !node.outputAmount || node.outputAmount <= 0 || !node.buildingCount || node.buildingCount <= 0) continue;
                    inputRequirements.set(node.outputItem, (inputRequirements.get(node.outputItem) || 0) + node.buildingCount * node.outputAmount);
                }
                for (const [itemId, required] of inputRequirements) if (required > 0 && !rawKeys.has(`${plan.id}:${itemId}`)) add(plan.id, itemId, required);
            }
            for (const [itemId, available] of coverage) if (!rows.has(itemId)) rows.set(itemId, { itemId, item: itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' }, perPlan: {}, totalRequired: 0, covered: 0, available, missing: 0 });
            return Array.from(rows.values()).map((row) => {
                const available = coverage.get(row.itemId) || 0;
                return { ...row, available, covered: Math.min(row.totalRequired, available), missing: Math.max(0, row.totalRequired - available) };
            }).sort((left, right) => right.missing - left.missing || right.totalRequired - left.totalRequired || left.item.name.localeCompare(right.item.name));
        });

    registrar.regSub(appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS,
        () => [[appIds.subscriptions.BASES_SELECTED_BASE], [appIds.subscriptions.BUILDINGS_LIST]],
        ([base, buildings], ..._params) => {
            void _params;
            if (!base || base.productions.length === 0) return [];
            const owned = new Map<string, number>();
            for (const building of base.buildings) if (building.sectionType === 'production') owned.set(building.buildingTypeId, (owned.get(building.buildingTypeId) || 0) + 1);
            const byId = new Map(buildings.map((building) => [building.id, building]));
            const rows = new Map<string, BuildingCoverageRow>();
            for (const plan of base.productions) for (const requirement of plan.requiredBuildings || []) {
                const building = byId.get(requirement.buildingId);
                if (!building || !isBuildingAvailableForSection(building, 'production')) continue;
                const existing = rows.get(requirement.buildingId);
                if (existing) { existing.perPlan[plan.id] = requirement.count; existing.totalRequired += requirement.count; }
                else rows.set(requirement.buildingId, { buildingId: requirement.buildingId, building, perPlan: { [plan.id]: requirement.count }, totalRequired: requirement.count, covered: 0, owned: 0, missing: 0 });
            }
            return Array.from(rows.values()).map((row) => {
                const count = owned.get(row.buildingId) || 0;
                return { ...row, owned: count, covered: Math.min(row.totalRequired, count), missing: Math.max(0, row.totalRequired - count) };
            }).sort((left, right) => right.totalRequired - left.totalRequired);
        });
};
