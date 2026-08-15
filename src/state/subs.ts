import { SUB_IDS } from './sub-ids';
import type { UkladContracts, UkladRegistrar } from '@ukladjs/core/vanilla';
import { stateKeys } from '@/app/uklad/catalog';
import type {
    Item,
    Corporation,
    Building as DbBuilding,
    BuildingsByIdMap,
    Base,
    BasesById,
    BaseBuilding,
    EnergyGroup,
    Production,
    CreateProductionPlanModalState,
    CorporationLevelSelection,
} from './db';
import type {
    CorporationLevelInfo,
    ProductionFlowResult,
} from '../components/planner/core/types';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import { buildRecipeOptionsForOutputItems } from '@/features/planner/recipe-options';
import { getItemName } from '../utils/itemUtils';
import { calculateBaseCoreHeatCapacity, isAmplifierBuilding, getCoreLevels } from '../components/mybases/utils/baseCoreUtils';
import {
    getAvailableBuildingsForSection,
    isBuildingAvailableForSection,
    isLogisticsExcludedOutputBuildingId,
} from '../components/mybases/utils/buildingSectionUtils';
import { buildActivePlanOccupancy } from '../components/mybases/utils/activePlanOccupancy';
import { calculateSharedInputShortages } from '../components/mybases/utils/sharedInputShortages';
import {
    computeRequiredBuildings,
    getFlowInputBuildings,
    getSelectedFlowInputBuildings,
    resolveInputBuilding,
    resolveLinkedOutput,
    sanitizeRecipeSelectionsForInputItems,
} from '../utils/productionPlanInputs';
import type { LinkedOutputStatus } from '../utils/productionPlanInputs';
import type {
    BaseDetailStats,
    BuildingSectionBuilding,
    LinkableOutputItem,
    BaseDefenseBuilding,
    BuildingSectionType,
    ProductionPlanSectionStats,
    BuildingRequirement,
    InputRequirement,
    SharedInputShortage,
    ProductionPlanSectionViewModel,
    PlanSummaryRow,
    MaterialBalanceRow,
    BuildingCoverageRow,
} from '../components/mybases/types';
import { buildAllBaseLogisticsViewModels, buildBaseLogisticsViewModel } from '../components/mybases/utils/logistics';
import { resolveOutputBuilding } from '../utils/planOutputAllocations';

export const registerSubscriptions = (registrar: UkladRegistrar<UkladContracts>) => {
//============================================================
// Root subscriptions
//============================================================
registrar.regRootSub(SUB_IDS.PRODUCTION_PLAN_MODAL_STATE, stateKeys.productionPlanModalState);

//============================================================
// Energy Groups subscriptions
//============================================================
//============================================================
// Bases subscriptions
//============================================================
interface ConfiguredSectionItem {
    baseBuildingId: string;
    item: Item;
    ratePerMinute: number;
    building: DbBuilding;
    name: string;
    description: string;
    linkedOutput?: {
        status: LinkedOutputStatus;
        baseId: string;
        buildingId: string;
        baseName: string;
        outputName: string;
    };
}

function collectConfiguredSectionItems(
    base: Base,
    buildingsById: BuildingsByIdMap,
    itemsMap: Record<string, Item>,
    sectionType: 'inputs' | 'outputs',
    allBases: Base[] = [base]
): ConfiguredSectionItem[] {
    const items: ConfiguredSectionItem[] = [];

    for (const baseBuilding of base.buildings) {
        if (baseBuilding.sectionType !== sectionType) continue;
        const resolvedBuilding = sectionType === 'inputs'
            ? resolveInputBuilding(baseBuilding, allBases)
            : resolveOutputBuilding(baseBuilding, base);
        const itemId = resolvedBuilding.selectedItemId ?? baseBuilding.linkedOutput?.itemIdSnapshot;
        const ratePerMinute = resolvedBuilding.ratePerMinute ?? baseBuilding.linkedOutput?.ratePerMinuteSnapshot;
        const hasRate = typeof ratePerMinute === 'number' && Number.isFinite(ratePerMinute);
        const hasPositiveRate = hasRate && ratePerMinute > 0;
        const includeZeroRateOutput = sectionType === 'outputs' && !!baseBuilding.sourceProductionId && hasRate;
        if (!itemId || (!hasPositiveRate && !includeZeroRateOutput)) continue;

        const building = buildingsById[resolvedBuilding.buildingTypeId];
        if (!building) continue;

        const item = itemsMap[itemId] || { id: itemId, name: itemId, type: 'unknown' };
        const linkedOutputResolution = baseBuilding.linkedOutput
            ? resolveLinkedOutput(baseBuilding, allBases)
            : null;
        const linkedOutputSourceBuilding = linkedOutputResolution?.sourceOutput
            ? buildingsById[linkedOutputResolution.sourceOutput.buildingTypeId]
            : null;
        const linkedOutput = baseBuilding.linkedOutput
            ? {
                status: linkedOutputResolution?.status || 'missing-output',
                baseId: baseBuilding.linkedOutput.baseId,
                buildingId: baseBuilding.linkedOutput.buildingId,
                baseName: linkedOutputResolution?.sourceBase?.name || 'Missing base',
                outputName:
                    linkedOutputResolution?.sourceOutput?.name ||
                    linkedOutputSourceBuilding?.name ||
                    baseBuilding.linkedOutput.buildingId,
            }
            : undefined;

        items.push({
            baseBuildingId: baseBuilding.id,
            item,
            ratePerMinute,
            building,
            name: baseBuilding.name || building.name || item.name,
            description: baseBuilding.description || '',
            linkedOutput,
        });
    }

    return items;
}

/** Pooled energy context — aggregated generation/consumption across an energy group. */
interface PooledEnergyContext {
    pooledGeneration: number;
    pooledConsumption: number;
}

/**
 * Calculate pooled energy for all bases in the same energy group.
 * Returns null if the base doesn't belong to a group.
 */
function calculatePooledEnergy(
    base: Base,
    allBases: Base[],
    buildingsById: BuildingsByIdMap,
    energyGroupsById: Record<string, EnergyGroup>,
): PooledEnergyContext | null {
    if (!base.energyGroupId) return null;
    if (!energyGroupsById[base.energyGroupId]) return null;

    let pooledGeneration = 0;
    let pooledConsumption = 0;

    for (const b of allBases) {
        if (b.energyGroupId !== base.energyGroupId) continue;
        for (const bb of b.buildings) {
            const buildingType = buildingsById[bb.buildingTypeId];
            if (!buildingType) continue;
            if (buildingType.type === 'generator') {
                pooledGeneration += buildingType.power || 0;
            } else {
                pooledConsumption += buildingType.power || 0;
            }
        }
    }

    return { pooledGeneration, pooledConsumption };
}

// Helper function to calculate stats for a base
function calculateBaseDetailStats(
    base: Base,
    buildingsById: BuildingsByIdMap,
    energyGroupsById?: Record<string, EnergyGroup>,
    allBases?: Base[],
): BaseDetailStats {
    let totalHeat = 0;
    let energyGeneration = 0;
    let energyConsumption = 0;

    base.buildings.forEach((baseBuilding: BaseBuilding) => {
        const buildingType = buildingsById[baseBuilding.buildingTypeId];
        if (buildingType) {
            totalHeat += buildingType.heat || 0;

            // Generators produce energy, other buildings consume it
            if (buildingType.type === 'generator') {
                energyGeneration += buildingType.power || 0;
            } else {
                energyConsumption += buildingType.power || 0;
            }
        }
    });

    // If this base belongs to an energy group, use pooled energy values
    const pooled = allBases && energyGroupsById
        ? calculatePooledEnergy(base, allBases, buildingsById, energyGroupsById)
        : null;
    const effectiveGeneration = pooled ? pooled.pooledGeneration : energyGeneration;
    const effectiveConsumption = energyConsumption;
    const energyGridConsumption = pooled ? pooled.pooledConsumption : energyConsumption;

    const coreLevel = base.coreLevel ?? 0;
    const baseCoreHeatCapacity = calculateBaseCoreHeatCapacity(coreLevel, base.buildings, buildingsById);
    const heatPercentage = Math.min((totalHeat / baseCoreHeatCapacity) * 100, 100);
    // Calculate energy percentage: used / available (similar to heat)
    // If no generation, show full red bar (100%)
    const energyPercentage = effectiveGeneration > 0
        ? Math.min((effectiveConsumption / effectiveGeneration) * 100, 100)
        : effectiveConsumption > 0
            ? 100 // Full red bar when consuming but no generation
            : 0;

    const isHeatOverCapacity = totalHeat > baseCoreHeatCapacity;
    const hasEnergyLoad = effectiveConsumption > 0;
    const isEnergyInsufficient = hasEnergyLoad && (effectiveGeneration === 0 || effectiveConsumption > effectiveGeneration);

    // Energy group info
    const energyGroupId = base.energyGroupId;
    const energyGroupName = energyGroupId && energyGroupsById
        ? energyGroupsById[energyGroupId]?.name
        : undefined;

    return {
        baseName: base.name,
        coreLevel,
        buildingCount: base.buildings.length,
        totalHeat,
        energyGeneration: effectiveGeneration,
        energyConsumption: effectiveConsumption,
        localEnergyGeneration: energyGeneration,
        energyGridConsumption,
        baseCoreHeatCapacity,
        heatPercentage,
        energyPercentage,
        isHeatOverCapacity,
        isEnergyInsufficient,
        energyGroupId,
        energyGroupName,
    };
}

registrar.regSub(SUB_IDS.BASES_SELECTED_BASE_DETAIL_STATS, () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ENERGY_GROUPS_BY_ID_MAP], [SUB_IDS.BASES_LIST]], ([selectedBase, buildingsById, energyGroupsById, allBases]: [Base | null, BuildingsByIdMap, Record<string, EnergyGroup>, Base[]]) => {
        if (!selectedBase) return null;
        return calculateBaseDetailStats(selectedBase, buildingsById, energyGroupsById, allBases);
    });

registrar.regSub(SUB_IDS.BASES_CORE_LEVELS, () => [[SUB_IDS.BUILDINGS_BY_ID_MAP]], ([buildingsById]: [BuildingsByIdMap]) => {
        return getCoreLevels(buildingsById);
    });

registrar.regSub(SUB_IDS.BASES_DETAIL_STATS_BY_BASE_ID, () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ENERGY_GROUPS_BY_ID_MAP], [SUB_IDS.BASES_LIST]], ([basesById, buildingsById, energyGroupsById, allBases]: [BasesById, BuildingsByIdMap, Record<string, EnergyGroup>, Base[]], baseId: string) => {
        const base = basesById[baseId];
        if (!base) return null;
        return calculateBaseDetailStats(base, buildingsById, energyGroupsById, allBases);
    });

registrar.regSub(SUB_IDS.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, () => [[SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP]], ([bases, buildingsById, itemsById]: [Base[], BuildingsByIdMap, Record<string, Item>], baseId: string) => {
        return buildBaseLogisticsViewModel({
            selectedBaseId: baseId,
            bases,
            buildingsById,
            itemsById,
        });
    });

registrar.regSub(SUB_IDS.BASES_LOGISTICS_VIEW_MODELS, () => [[SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP]], ([bases, buildingsById, itemsById]: [Base[], BuildingsByIdMap, Record<string, Item>]) => {
        return buildAllBaseLogisticsViewModels({
            bases,
            buildingsById,
            itemsById,
        });
    });

registrar.regSub(SUB_IDS.BASES_ALL_DETAIL_STATS, () => [[SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ENERGY_GROUPS_BY_ID_MAP]], ([bases, buildingsById, energyGroupsById]: [Base[], BuildingsByIdMap, Record<string, EnergyGroup>]) => {
        const result: Record<string, BaseDetailStats> = {};
        for (const base of bases) {
            result[base.id] = calculateBaseDetailStats(base, buildingsById, energyGroupsById, bases);
        }
        return result;
    });

registrar.regSub(SUB_IDS.BASES_INPUT_ITEMS_BY_BASE_ID, () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP], [SUB_IDS.BASES_LIST]], ([basesById, buildingsById, itemsMap, allBases]: [BasesById, BuildingsByIdMap, Record<string, Item>, Base[]], baseId: string) => {
        const base = basesById[baseId];
        if (!base) return [];

        return collectConfiguredSectionItems(base, buildingsById, itemsMap, 'inputs', allBases).map((entry) => ({
            baseBuildingId: entry.baseBuildingId,
            item: entry.item,
            ratePerMinute: entry.ratePerMinute,
            building: entry.building,
            name: entry.name,
            description: entry.description,
            linkedOutput: entry.linkedOutput,
        }));
    });

registrar.regSub(SUB_IDS.BASES_OUTPUT_ITEMS_BY_BASE_ID, () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP]], ([basesById, buildingsById, itemsMap]: [BasesById, BuildingsByIdMap, Record<string, Item>], baseId: string) => {
        const base = basesById[baseId];
        if (!base) return [];

        return collectConfiguredSectionItems(base, buildingsById, itemsMap, 'outputs').map((entry) => ({
            baseBuildingId: entry.baseBuildingId,
            item: entry.item,
            ratePerMinute: entry.ratePerMinute,
            building: entry.building,
            name: entry.name,
            description: entry.description,
        }));
    });

registrar.regSub(SUB_IDS.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP]], ([basesById, buildingsById]: [BasesById, BuildingsByIdMap], baseId: string) => {
        const base = basesById[baseId];
        if (!base) return [];

        const defenseMap = new Map<string, BaseDefenseBuilding>();

        base.buildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildingsById[baseBuilding.buildingTypeId];
            if (building && building.type === 'defense') {
                const existing = defenseMap.get(building.id);
                if (existing) {
                    existing.count += 1;
                } else {
                    defenseMap.set(building.id, { building, count: 1 });
                }
            }
        });

        return Array.from(defenseMap.values());
    });

registrar.regSub(SUB_IDS.BASES_BUILDING_SECTION_BUILDINGS, (baseId: string) => [[SUB_IDS.BASES_BASE_BY_ID, baseId], [SUB_IDS.BUILDINGS_BY_ID_MAP]], ([base, buildingsById]: [Base | null, BuildingsByIdMap], _baseId: string, sectionType: BuildingSectionType) => {
        if (!base) return [];

        const sectionBuildings = base.buildings.filter(b => b.sectionType === sectionType);
        if (sectionBuildings.length === 0) return [];

        // Build active-plan highlight map for the entire base.
        // Production buildings overlap only when free buildings are exhausted.
        const activePlansById = new Map<string, Production>();
        (base.productions || [])
            .filter((plan) => plan.active)
            .forEach((plan) => {
                activePlansById.set(plan.id, plan);
            });

        const occupancy = buildActivePlanOccupancy(base);
        const planNamesByBuildingId = new Map<string, Set<string>>();
        const addPlanName = (buildingId: string, planName: string) => {
            if (!buildingId || !planName) return;
            let set = planNamesByBuildingId.get(buildingId);
            if (!set) {
                set = new Set<string>();
                planNamesByBuildingId.set(buildingId, set);
            }
            set.add(planName);
        };

        const baseBuildingIds = new Set(base.buildings.map((b) => b.id));
        occupancy.assignedPlanBuildingIds.forEach((buildingIds, planId) => {
            const planName = activePlansById.get(planId)?.name;
            if (!planName) return;
            buildingIds.forEach((buildingId) => {
                addPlanName(buildingId, planName);
            });
        });
        (base.productions || [])
            .filter((plan) => plan.active)
            .forEach((plan) => {
                for (const inputBuilding of plan.inputs || []) {
                    if (inputBuilding.id && baseBuildingIds.has(inputBuilding.id)) {
                        addPlanName(inputBuilding.id, plan.name);
                    }
                }
            });

        const entries = sectionBuildings
            .map((baseBuilding): BuildingSectionBuilding | null => {
                const building = buildingsById[baseBuilding.buildingTypeId];
                if (!building) return null;
                const planNames = Array.from(planNamesByBuildingId.get(baseBuilding.id) || []);
                return {
                    id: baseBuilding.id,
                    buildingTypeId: baseBuilding.buildingTypeId,
                    sectionType,
                    baseBuilding,
                    building,
                    count: 1,
                    isGrouped: false,
                    activePlanNames: planNames,
                };
            })
            .filter((b): b is BuildingSectionBuilding => b !== null);

        if (sectionType !== 'energy' && sectionType !== 'production') {
            return entries;
        }

        const groupedEntries = new Map<string, {
            id: string;
            buildingTypeId: string;
            sectionType: BuildingSectionType;
            building: DbBuilding;
            count: number;
            activePlanNames: Set<string>;
        }>();

        for (const entry of entries) {
            const existing = groupedEntries.get(entry.buildingTypeId);
            if (existing) {
                existing.count += 1;
                entry.activePlanNames.forEach((planName) => existing.activePlanNames.add(planName));
                continue;
            }

            groupedEntries.set(entry.buildingTypeId, {
                id: `${sectionType}:${entry.buildingTypeId}`,
                buildingTypeId: entry.buildingTypeId,
                sectionType,
                building: entry.building,
                count: 1,
                activePlanNames: new Set(entry.activePlanNames),
            });
        }

        return Array.from(groupedEntries.values()).map((entry) => ({
            id: entry.id,
            buildingTypeId: entry.buildingTypeId,
            sectionType: entry.sectionType,
            building: entry.building,
            count: entry.count,
            isGrouped: true,
            activePlanNames: Array.from(entry.activePlanNames),
        }));
    });

registrar.regSub(SUB_IDS.BASES_BUILDING_SECTION_STATS, () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP]], ([basesById, buildingsById]: [BasesById, BuildingsByIdMap], baseId: string, sectionType: string) => {
        const base = basesById[baseId];
        if (!base) {
            return {
                buildingCount: 0,
                totalHeat: 0,
                totalPowerGeneration: 0,
                totalPowerConsumption: 0,
                hasGenerators: false,
            };
        }

        // Filter base buildings by the section type they were added to
        const baseBuildings = base.buildings.filter((baseBuilding: BaseBuilding) => {
            return baseBuilding.sectionType === sectionType;
        });

        let totalHeat = 0;
        let totalPowerGeneration = 0;
        let totalPowerConsumption = 0;
        let hasGenerators = false;

        baseBuildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildingsById[baseBuilding.buildingTypeId];
            if (building) {
                // Exclude amplifiers from heat calculation (they increase capacity but don't generate heat)
                if (!isAmplifierBuilding(building.id)) {
                    totalHeat += building.heat || 0;
                }
                // Generators produce power, other buildings consume it
                if (building.type === 'generator') {
                    hasGenerators = true;
                    totalPowerGeneration += building.power || 0;
                } else {
                    totalPowerConsumption += building.power || 0;
                }
            }
        });

        return {
            buildingCount: baseBuildings.length,
            totalHeat,
            totalPowerGeneration,
            totalPowerConsumption,
            hasGenerators,
        };
    });

registrar.regSub(SUB_IDS.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, () => [[SUB_IDS.BUILDINGS_LIST]], ([buildings]: [DbBuilding[]], sectionType: BuildingSectionType) => {
        return getAvailableBuildingsForSection(buildings, sectionType);
    });

registrar.regSub(SUB_IDS.BASES_STATS_SUMMARY, () => [[SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_BY_ID_MAP]], ([bases, buildingsById]: [Base[], BuildingsByIdMap]) => {
        let totalBuildings = 0;
        let totalHeat = 0;
        let totalHeatCapacity = 0;
        let totalEnergyUsed = 0;
        let totalEnergyProduced = 0;

        bases.forEach((base: Base) => {
            totalBuildings += base.buildings.length;

            // Calculate heat capacity for this base
            totalHeatCapacity += calculateBaseCoreHeatCapacity(base.coreLevel ?? 0, base.buildings, buildingsById);

            base.buildings.forEach((baseBuilding: BaseBuilding) => {
                const buildingType = buildingsById[baseBuilding.buildingTypeId];
                if (buildingType) {
                    // Exclude amplifiers from heat calculation (they increase capacity but don't generate heat)
                    if (!isAmplifierBuilding(buildingType.id)) {
                        totalHeat += buildingType.heat || 0;
                    }
                    // Energy: generators produce, others consume
                    if (buildingType.type === 'generator') {
                        totalEnergyProduced += buildingType.power || 0;
                    } else {
                        totalEnergyUsed += buildingType.power || 0;
                    }
                }
            });
        });

        // Calculate percentages and error states
        const heatPercentage = totalHeatCapacity > 0
            ? Math.min((totalHeat / totalHeatCapacity) * 100, 100)
            : 0;
        const isHeatOverCapacity = totalHeat > totalHeatCapacity;

        const energyPercentage = totalEnergyProduced > 0
            ? Math.min((totalEnergyUsed / totalEnergyProduced) * 100, 100)
            : totalEnergyUsed > 0
                ? 100
                : 0;
        const isEnergyInsufficient = totalEnergyUsed > 0 && (totalEnergyProduced === 0 || totalEnergyUsed > totalEnergyProduced);

        const totalPlans = bases.reduce((sum, base) => sum + (base.productions?.length ?? 0), 0);
        return {
            totalBases: bases.length,
            totalBuildings,
            totalPlans,
            totalHeat,
            totalHeatCapacity,
            totalEnergyUsed,
            totalEnergyProduced,
            heatPercentage,
            energyPercentage,
            isHeatOverCapacity,
            isEnergyInsufficient,
        };
    });

//============================================================
// Production Plan subscriptions
//============================================================
registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_IDS, () => [[SUB_IDS.BASES_SELECTED_BASE]], ([selectedBase]: [Base | null]) => {
        if (!selectedBase) return [];
        return (selectedBase.productions || []).map(section => section.id);
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, (baseId: string) => [[SUB_IDS.BASES_BASE_BY_ID, baseId]], ([base]: [Base | null], _baseId: string, sectionId: string) => {
        if (!base || !sectionId) return null;
        return base.productions?.find(section => section.id === sectionId) || null;
    });

const EMPTY_PRODUCTION_FLOW: ProductionFlowResult = { nodes: [], edges: [], rawMaterialDeficits: [] };
const EMPTY_PRODUCTION_PLAN_SECTION_STATS: ProductionPlanSectionStats = {
    buildingCount: 0,
    totalHeat: 0,
    totalPowerConsumption: 0,
};

const isLauncherEnabled = (corporationLevel?: CorporationLevelSelection | null): boolean =>
    corporationLevel !== null && corporationLevel !== undefined;

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, (baseId: string, sectionId: string) => [[SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.BASES_LIST]], ([section, buildings, allBases]: [Production | null, DbBuilding[], Base[]]) => {
        if (!section || !section.selectedItemId) {
            return EMPTY_PRODUCTION_FLOW;
        }

        const validAmount = section.targetAmount > 0 ? section.targetAmount : 1;
        const inputBuildings = getFlowInputBuildings(section.inputs || [], allBases);
        const recipeSelections = sanitizeRecipeSelectionsForInputItems(section.recipeSelections, inputBuildings);

        return buildProductionFlow(
            {
                targetItemId: section.selectedItemId,
                targetAmount: validAmount,
                inputBuildings,
                rawProductionDisabled: true,
                includeLauncher: isLauncherEnabled(section.corporationLevel),
                recipeSelections,
            },
            buildings
        );
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.BASES_BY_ID_MAP]], ([modalState, buildings, basesById]: [CreateProductionPlanModalState, DbBuilding[], BasesById]) => {
        const {
            selectedItemId,
            targetAmount,
            selectedCorporationLevel,
            selectedInputIds,
            recipeSelections,
            baseId
        } = modalState;

        if (!selectedItemId) {
            return EMPTY_PRODUCTION_FLOW;
        }

        const validAmount = targetAmount > 0 ? targetAmount : 1;
        const base = baseId ? basesById[baseId] || null : null;
        const inputBuildings = getSelectedFlowInputBuildings(base, selectedInputIds || [], Object.values(basesById));
        const sanitizedRecipeSelections = sanitizeRecipeSelectionsForInputItems(recipeSelections, inputBuildings);

        return buildProductionFlow(
            {
                targetItemId: selectedItemId,
                targetAmount: validAmount,
                inputBuildings,
                rawProductionDisabled: true,
                includeLauncher: isLauncherEnabled(selectedCorporationLevel),
                recipeSelections: sanitizedRecipeSelections
            },
            buildings
        );
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS, () => [
        [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE],
        [SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW],
        [SUB_IDS.BUILDINGS_LIST],
        [SUB_IDS.ITEMS_BY_ID_MAP],
        [SUB_IDS.BASES_BY_ID_MAP]
    ], ([modalState, productionFlow, buildings, itemsById, basesById]: [CreateProductionPlanModalState, ProductionFlowResult, DbBuilding[], Record<string, Item>, BasesById]) => {
        if (!modalState.selectedItemId || !productionFlow?.nodes?.length) return [];

        const base = modalState.baseId ? basesById[modalState.baseId] || null : null;
        const inputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], Object.values(basesById));
        const inputItemIds = new Set(
            inputBuildings
                .map((input) => input.selectedItemId)
                .filter((id): id is string => !!id)
        );

        const outputItems = new Set<string>();
        for (const node of productionFlow.nodes) {
            if (node.nodeType === 'production') {
                if (inputItemIds.has(node.outputItem)) continue;
                outputItems.add(node.outputItem);
            }
        }

        return buildRecipeOptionsForOutputItems(
            outputItems,
            buildings,
            itemsById,
            modalState.recipeSelections || {}
        );
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS, () => [[SUB_IDS.CORPORATIONS_LIST], [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]], ([corporations, modalState]: [Corporation[], CreateProductionPlanModalState]) => {
        const { selectedItemId } = modalState;
        if (!selectedItemId) return [];

        const levels: CorporationLevelInfo[] = [];
        for (const corporation of corporations) {
            for (const level of corporation.levels) {
                for (const component of level.components) {
                    if (component.id === selectedItemId) {
                        levels.push({
                            corporationName: corporation.name,
                            corporationId: corporation.id,
                            level: level.level,
                            points: component.points,
                            cost: component.cost
                        });
                    }
                }
            }
        }
        return levels;
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_STATS_BY_ID, (baseId: string, sectionId: string) => [[SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId], [SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId]], ([productionFlow, section]: [ProductionFlowResult, Production | null]) => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return EMPTY_PRODUCTION_PLAN_SECTION_STATS;
        }

        // Count buildings from production flow nodes (excluding custom input nodes)
        const productionBuildings = productionFlow.nodes
            .filter(node => node.nodeType !== 'input')
            .reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0);

        // Count custom input buildings from section snapshots to keep existing behavior
        const customInputBuildings = (section?.inputs || []).length;

        const totalBuildings = productionBuildings + customInputBuildings;
        const totalHeat = productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0);
        const totalPower = productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0);

        return {
            buildingCount: totalBuildings,
            totalHeat,
            totalPowerConsumption: totalPower,
        };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, (baseId: string, sectionId: string) => [
        [SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId],
        [SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId],
        [SUB_IDS.BASES_BASE_BY_ID, baseId],
        [SUB_IDS.BASES_LIST],
        [SUB_IDS.ITEMS_BY_ID_MAP],
        [SUB_IDS.BUILDINGS_LIST],
        [SUB_IDS.BUILDINGS_BY_ID_MAP],
        [SUB_IDS.CORPORATIONS_LIST],
    ], ([section, productionFlow, base, allBases, itemsMap, buildings, buildingsById, corporations]: [Production | null, ProductionFlowResult, Base | null, Base[], Record<string, Item>, DbBuilding[], BuildingsByIdMap, Corporation[]]) => {

        if (!base || !section) {
            return null;
        }

        // Item name — derived from items lookup
        const itemName = section.selectedItemId
            ? (itemsMap[section.selectedItemId]?.name || section.selectedItemId)
            : '';

        // Corporation name — derived from corporations lookup
        const corporationName = section.corporationLevel
            ? (corporations.find(c => c.id === section.corporationLevel?.corporationId)?.name || null)
            : null;

        // Stats — calculated from buildings map by looking up building types
        const requiredBuildings = productionFlow.nodes.length > 0
            ? computeRequiredBuildings(productionFlow)
            : section.requiredBuildings || [];
        const sectionInputSnapshots = section.inputs || [];
        const sectionInputs = sectionInputSnapshots.map((input) => resolveInputBuilding(input, allBases));

        // Calculate heat/power from required buildings
        let totalHeat = 0;
        let totalPowerConsumption = 0;
        requiredBuildings.forEach(({ buildingId, count }) => {
            const building = buildingsById[buildingId];
            if (building) {
                totalHeat += (building.heat || 0) * count;
                totalPowerConsumption += (building.power || 0) * count;
            }
        });

        // Also account for input buildings
        sectionInputs.forEach((inputBuilding: BaseBuilding) => {
            const building = buildingsById[inputBuilding.buildingTypeId];
            if (building) {
                totalHeat += building.heat || 0;
                totalPowerConsumption += building.power || 0;
            }
        });

        const stats: ProductionPlanSectionStats = {
            buildingCount:
                requiredBuildings.reduce((sum, b) => sum + b.count, 0) +
                sectionInputs.length,
            totalHeat,
            totalPowerConsumption,
        };

        // --- Building requirements: compare requirements vs base buildings not reserved by other active plans ---
        const occupancyFromOtherPlans = buildActivePlanOccupancy(base, { excludePlanId: section.id });
        const totalBuildingsMap = new Map<string, number>();
        base.buildings.forEach((baseBuilding) => {
            const count = totalBuildingsMap.get(baseBuilding.buildingTypeId) || 0;
            totalBuildingsMap.set(baseBuilding.buildingTypeId, count + 1);
        });

        const buildingRequirements: BuildingRequirement[] = [];
        let allRequirementsSatisfied = true;

        requiredBuildings.forEach(({ buildingId, count }) => {
            const total = totalBuildingsMap.get(buildingId) || 0;
            const occupied = occupancyFromOtherPlans.occupiedBuildingTypeCounts.get(buildingId) || 0;
            const available = Math.max(0, total - occupied);
            const isSatisfied = available >= count;
            if (!isSatisfied) allRequirementsSatisfied = false;
            const building = buildingsById[buildingId];

            buildingRequirements.push({
                buildingId,
                buildingName: building?.name || buildingId,
                required: count,
                available,
                isSatisfied,
            });
        });

        buildingRequirements.sort((a, b) => {
            if (a.isSatisfied !== b.isSatisfied) return a.isSatisfied ? 1 : -1;
            return a.buildingName.localeCompare(b.buildingName);
        });

        const baseBuildingsById = new Map(base.buildings.map(b => [b.id, b]));
        const baseInputBuildingsById = new Map(
            base.buildings
                .filter((baseBuilding) =>
                    baseBuilding.sectionType === 'inputs' &&
                    !!baseBuilding.selectedItemId &&
                    !!baseBuilding.ratePerMinute &&
                    baseBuilding.ratePerMinute > 0
                )
                .map((baseBuilding) => [baseBuilding.id, baseBuilding])
        );

        // --- Input requirements: derived from section.inputs + name lookups ---
        const inputRequirements: InputRequirement[] = [];
        let allInputsSatisfied = true;

        if (sectionInputSnapshots.length > 0) {
            sectionInputSnapshots.forEach((inputBuilding: BaseBuilding) => {
                const resolvedInput = resolveInputBuilding(inputBuilding, allBases);
                const matchingBaseBuilding = baseBuildingsById.get(inputBuilding.id);
                const building = buildingsById[resolvedInput.buildingTypeId] || null;
                const itemId = resolvedInput.selectedItemId || inputBuilding.linkedOutput?.itemIdSnapshot || '';
                const item = itemId ? itemsMap[itemId] || { id: itemId, name: itemId, type: 'unknown' } : null;
                const ratePerMinute = resolvedInput.ratePerMinute || inputBuilding.linkedOutput?.ratePerMinuteSnapshot || 0;
                const linkedOutputResolution = inputBuilding.linkedOutput
                    ? resolveLinkedOutput(inputBuilding, allBases)
                    : null;
                const linkedOutputSourceBuilding = linkedOutputResolution?.sourceOutput
                    ? buildingsById[linkedOutputResolution.sourceOutput.buildingTypeId]
                    : null;
                const linkedOutputStatus = resolvedInput.linkedOutputStatus || linkedOutputResolution?.status;

                const isLinkedInputSatisfied = !!(
                    inputBuilding.linkedOutput &&
                    matchingBaseBuilding &&
                    matchingBaseBuilding.sectionType === 'inputs' &&
                    matchingBaseBuilding.linkedOutput?.baseId === inputBuilding.linkedOutput.baseId &&
                    matchingBaseBuilding.linkedOutput?.buildingId === inputBuilding.linkedOutput.buildingId &&
                    linkedOutputStatus === 'ok' &&
                    building &&
                    item
                );
                const isManualInputSatisfied = !!(
                    !inputBuilding.linkedOutput &&
                    matchingBaseBuilding &&
                    matchingBaseBuilding.sectionType === 'inputs' &&
                    matchingBaseBuilding.selectedItemId === inputBuilding.selectedItemId &&
                    matchingBaseBuilding.ratePerMinute === inputBuilding.ratePerMinute &&
                    building &&
                    item
                );
                const isSatisfied = inputBuilding.linkedOutput ? isLinkedInputSatisfied : isManualInputSatisfied;

                if (!isSatisfied) allInputsSatisfied = false;

                inputRequirements.push({
                    baseBuildingId: inputBuilding.id,
                    buildingId: building?.id || resolvedInput.buildingTypeId,
                    buildingName: building?.name || resolvedInput.buildingTypeId,
                    itemId,
                    itemName: item?.name || inputBuilding.selectedItemId || '',
                    ratePerMinute,
                    isSatisfied,
                    linkedOutput: inputBuilding.linkedOutput
                        ? {
                            status: linkedOutputStatus || 'missing-output',
                            baseName: linkedOutputResolution?.sourceBase?.name || 'Missing base',
                            outputName:
                                linkedOutputResolution?.sourceOutput?.name ||
                                linkedOutputSourceBuilding?.name ||
                                inputBuilding.linkedOutput.buildingId,
                        }
                        : undefined,
                });
            });
        }

        const sharedInputShortages: SharedInputShortage[] = calculateSharedInputShortages(base, section.id, buildings, allBases).map((shortage) => {
            const matchingBaseInput = baseInputBuildingsById.get(shortage.baseBuildingId);
            const customInputName = (matchingBaseInput?.name || '').trim();
            const itemId = shortage.itemId || matchingBaseInput?.selectedItemId || '';
            const itemName = itemId ? (itemsMap[itemId]?.name || itemId) : 'Unknown input';

            return {
                ...shortage,
                inputName: customInputName || itemName,
                itemId,
                itemName,
            };
        });
        const hasRawMaterialShortage = (productionFlow.rawMaterialDeficits || []).length > 0;
        const hasMaterialShortage = sharedInputShortages.length > 0 || hasRawMaterialShortage;

        // Determine plan status: error if inputs insufficient, otherwise use section.status or derive from active state
        const planStatus = section.status || (section.active ? 'active' : 'inactive');
        const hasError = planStatus === 'error' || !allInputsSatisfied;
        // Always show manage button if there are any requirements to manage
        const showManageButton = buildingRequirements.length > 0 || inputRequirements.length > 0;

        return {
            selectedBaseId: base.id,
            section,
            itemName,
            corporationName,
            stats,
            buildingRequirements,
            inputRequirements,
            sharedInputShortages,
            hasRawMaterialShortage,
            hasMaterialShortage,
            allRequirementsSatisfied,
            planStatus,
            hasError,
            showManageButton,
        };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, (baseId: string, sectionId: string) => [
        [SUB_IDS.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, sectionId],
    ], ([sectionData]: [ProductionPlanSectionViewModel | null]) => {
        if (!sectionData) {
            return {
                allRequirementsSatisfied: false,
                planStatus: 'inactive',
                hasError: false,
                hasMaterialShortage: false,
                itemName: '',
                corporationName: null
            };
        }
        return {
            allRequirementsSatisfied: sectionData.allRequirementsSatisfied,
            planStatus: sectionData.planStatus,
            hasError: sectionData.hasError,
            hasMaterialShortage: sectionData.hasMaterialShortage,
            itemName: sectionData.itemName,
            corporationName: sectionData.corporationName
        };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, () => [[SUB_IDS.ITEMS_BY_ID_MAP]], ([itemsMap]: [Record<string, Item>], selectedItemId: string) => {
        if (!selectedItemId) return '';
        const item = itemsMap[selectedItemId];
        return item?.name || selectedItemId;
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_OPEN_STATE, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]], ([modalState]: [CreateProductionPlanModalState]) => {
        return {
            isOpen: modalState.isOpen,
        };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_HEADER_DATA, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]], ([modalState]: [CreateProductionPlanModalState]) => {
        return {
            isEditMode: !!modalState.editSectionId,
        };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_FORM_VALUES, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.ITEMS_LIST]], ([modalState, items]: [CreateProductionPlanModalState, Item[]]) => {
        const selectedItemName = modalState.selectedItemId
            ? items.find(i => i.id === modalState.selectedItemId)?.name || ''
            : '';

        return {
            defaultName: modalState.name,
            currentSelectedItemId: modalState.selectedItemId,
            currentTargetAmount: modalState.targetAmount,
            defaultSelectedCorporationLevel: modalState.selectedCorporationLevel,
            selectedItemName,
            matchInputs: modalState.matchInputs,
        };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA, () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP], [SUB_IDS.BASES_LIST], [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]], ([basesById, buildingsById, itemsMap, allBases, modalState]: [BasesById, BuildingsByIdMap, Record<string, Item>, Base[], CreateProductionPlanModalState]) => {
        const { baseId, selectedInputIds } = modalState;
        if (!baseId) return { inputItems: [], selectedInputIds: [] };

        const base = basesById[baseId];
        if (!base) return { inputItems: [], selectedInputIds: [] };

        const inputItems = collectConfiguredSectionItems(base, buildingsById, itemsMap, 'inputs', allBases)
            .map((entry) => ({
                baseBuildingId: entry.baseBuildingId,
                item: entry.item,
                ratePerMinute: entry.ratePerMinute,
                building: entry.building,
                name: entry.name,
                description: entry.description,
                linkedOutput: entry.linkedOutput,
            }));

        return { inputItems, selectedInputIds: selectedInputIds || [] };
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS, () => [[SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP], [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]], ([bases, buildingsById, itemsMap, modalState]: [Base[], BuildingsByIdMap, Record<string, Item>, CreateProductionPlanModalState]) => {
        const currentBaseId = modalState.baseId;
        const linkableOutputs: LinkableOutputItem[] = [];

        for (const base of bases) {
            for (const entry of collectConfiguredSectionItems(base, buildingsById, itemsMap, 'outputs')) {
                if (isLogisticsExcludedOutputBuildingId(entry.building.id)) {
                    continue;
                }
                linkableOutputs.push({
                    baseId: base.id,
                    baseName: base.name,
                    isCurrentBase: base.id === currentBaseId,
                    baseBuildingId: entry.baseBuildingId,
                    item: entry.item,
                    ratePerMinute: entry.ratePerMinute,
                    building: entry.building,
                    name: entry.name,
                    description: entry.description,
                });
            }
        }

        return linkableOutputs.sort((left, right) => {
            if (left.isCurrentBase !== right.isCurrentBase) return left.isCurrentBase ? -1 : 1;
            const baseDelta = left.baseName.localeCompare(right.baseName);
            if (baseDelta !== 0) return baseDelta;
            return left.item.name.localeCompare(right.item.name);
        });
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]], ([modalState]: [CreateProductionPlanModalState]) => {
        return modalState.selectedItemId;
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW], [SUB_IDS.ITEMS_LIST]], ([productionFlow, items]: [ProductionFlowResult, Item[]]) => {
        const deficits = productionFlow.rawMaterialDeficits || [];
        return deficits.map(deficit => ({
            ...deficit,
            itemName: getItemName(deficit.itemId, items),
        }));
    });

registrar.regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_FORM_VALIDITY, () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID]], ([modalState, selectedItemId]: [CreateProductionPlanModalState, string]) => {
        const { name, targetAmount } = modalState;
        return !!(name.trim() && selectedItemId && targetAmount > 0);
    });

//============================================================
// Base Overview subscriptions
//============================================================

function derivePlanStatus(plan: Production): PlanSummaryRow['status'] {
    if (plan.status === 'active' || plan.status === 'inactive' || plan.status === 'error') {
        return plan.status;
    }
    return plan.active ? 'active' : 'inactive';
}

const PLAN_STATUS_SORT_WEIGHT: Record<PlanSummaryRow['status'], number> = {
    active: 0,
    error: 1,
    inactive: 2,
};

function comparePlanSummaryRows(left: PlanSummaryRow, right: PlanSummaryRow): number {
    const statusDelta = PLAN_STATUS_SORT_WEIGHT[left.status] - PLAN_STATUS_SORT_WEIGHT[right.status];
    if (statusDelta !== 0) return statusDelta;

    const itemDelta = left.itemName.localeCompare(right.itemName);
    if (itemDelta !== 0) return itemDelta;

    return left.name.localeCompare(right.name);
}

registrar.regSub(SUB_IDS.BASES_OVERVIEW_PLAN_ROWS, () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.CORPORATIONS_LIST], [SUB_IDS.ITEMS_BY_ID_MAP]], ([selectedBase, corporations, itemsById]: [Base | null, Corporation[], Record<string, Item>]) => {
        if (!selectedBase) return [];

        const corporationNameById = new Map(
            corporations.map((corporation) => [corporation.id, corporation.name])
        );

        return (selectedBase.productions || [])
            .map((plan) => ({
                id: plan.id,
                name: plan.name,
                selectedItemId: plan.selectedItemId,
                targetItem: itemsById[plan.selectedItemId] || null,
                itemName: itemsById[plan.selectedItemId]?.name || plan.selectedItemId,
                targetAmount: plan.targetAmount,
                status: derivePlanStatus(plan),
                requiredBuildingCount: (plan.requiredBuildings || []).reduce((sum, rb) => sum + rb.count, 0),
                inputCount: (plan.inputs || []).length,
                corporationLabel: plan.corporationLevel
                    ? `${corporationNameById.get(plan.corporationLevel.corporationId) || 'Corporation'} Lv.${plan.corporationLevel.level}`
                    : 'None',
            }))
            .sort(comparePlanSummaryRows);
    });

registrar.regSub(SUB_IDS.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS, () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.ITEMS_BY_ID_MAP]], ([selectedBase, allBases, buildings, itemsById]: [Base | null, Base[], DbBuilding[], Record<string, Item>]) => {
        if (!selectedBase) return [];

        const plans = selectedBase.productions || [];

        const coverageByItem = new Map<string, number>();
        for (const baseBuilding of selectedBase.buildings) {
            if (baseBuilding.sectionType !== 'inputs') continue;
            const resolvedInput = resolveInputBuilding(baseBuilding, allBases);
            if (resolvedInput.linkedOutput && resolvedInput.linkedOutputStatus !== 'ok') continue;
            if (!resolvedInput.selectedItemId) continue;
            if (!resolvedInput.ratePerMinute || resolvedInput.ratePerMinute <= 0) continue;
            coverageByItem.set(
                resolvedInput.selectedItemId,
                (coverageByItem.get(resolvedInput.selectedItemId) || 0) + resolvedInput.ratePerMinute
            );
        }

        const requirementsByItem = new Map<string, MaterialBalanceRow>();
        const rawRequirementKeys = new Set<string>();

        for (const plan of plans) {
            if (plan.selectedItemId && plan.targetAmount > 0) {
                const flow = buildProductionFlow(
                    {
                        targetItemId: plan.selectedItemId,
                        targetAmount: plan.targetAmount,
                        inputBuildings: getFlowInputBuildings(plan.inputs || [], allBases),
                        rawProductionDisabled: true,
                        includeLauncher: isLauncherEnabled(plan.corporationLevel),
                        recipeSelections: plan.recipeSelections || {},
                    },
                    buildings
                );

                for (const deficit of flow.rawMaterialDeficits || []) {
                    rawRequirementKeys.add(`${plan.id}:${deficit.itemId}`);
                    const item = itemsById[deficit.itemId] || { id: deficit.itemId, name: deficit.itemId, type: 'unknown' };
                    const existing = requirementsByItem.get(deficit.itemId);
                    if (existing) {
                        existing.perPlan[plan.id] = (existing.perPlan[plan.id] || 0) + deficit.required;
                        existing.totalRequired += deficit.required;
                        continue;
                    }

                    requirementsByItem.set(deficit.itemId, {
                        itemId: deficit.itemId,
                        item,
                        perPlan: { [plan.id]: deficit.required },
                        totalRequired: deficit.required,
                        covered: 0,
                        available: 0,
                        missing: 0,
                    });
                }

                const flowWithInputs = buildProductionFlow(
                    {
                        targetItemId: plan.selectedItemId,
                        targetAmount: plan.targetAmount,
                        inputBuildings: getFlowInputBuildings(plan.inputs || [], allBases),
                        rawProductionDisabled: true,
                        includeLauncher: isLauncherEnabled(plan.corporationLevel),
                        recipeSelections: plan.recipeSelections || {},
                    },
                    buildings
                );

                const planInputRequiredByItem = new Map<string, number>();
                for (const node of flowWithInputs.nodes) {
                    if (node.nodeType !== 'input' || !node.outputItem) continue;
                    if (!node.outputAmount || node.outputAmount <= 0) continue;
                    if (!node.buildingCount || node.buildingCount <= 0) continue;

                    const required = node.buildingCount * node.outputAmount;
                    if (required <= 0) continue;

                    planInputRequiredByItem.set(
                        node.outputItem,
                        (planInputRequiredByItem.get(node.outputItem) || 0) + required
                    );
                }

                for (const [itemId, required] of planInputRequiredByItem) {
                    if (required <= 0) continue;

                    // Raw requirements are already accounted for via production deficits.
                    if (rawRequirementKeys.has(`${plan.id}:${itemId}`)) continue;

                    const item = itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' };
                    const existing = requirementsByItem.get(itemId);
                    if (existing) {
                        existing.perPlan[plan.id] = (existing.perPlan[plan.id] || 0) + required;
                        existing.totalRequired += required;
                        continue;
                    }

                    requirementsByItem.set(itemId, {
                        itemId,
                        item,
                        perPlan: { [plan.id]: required },
                        totalRequired: required,
                        covered: 0,
                        available: 0,
                        missing: 0,
                    });
                }
            }
        }

        // Also show configured inputs that are currently unused by all plans.
        for (const [itemId, available] of coverageByItem) {
            if (requirementsByItem.has(itemId)) continue;
            const item = itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' };
            requirementsByItem.set(itemId, {
                itemId,
                item,
                perPlan: {},
                totalRequired: 0,
                covered: 0,
                available,
                missing: 0,
            });
        }

        return Array.from(requirementsByItem.values())
            .map((row) => {
                const available = coverageByItem.get(row.itemId) || 0;
                const covered = Math.min(row.totalRequired, available);
                const missing = Math.max(0, row.totalRequired - available);
                return { ...row, covered, available, missing };
            })
            .sort((left, right) => {
                if (left.missing !== right.missing) return right.missing - left.missing;
                if (left.totalRequired !== right.totalRequired) return right.totalRequired - left.totalRequired;
                return left.item.name.localeCompare(right.item.name);
            });
    });

registrar.regSub(SUB_IDS.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS, () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BUILDINGS_LIST]], ([selectedBase, buildings]: [Base | null, DbBuilding[]]) => {
        if (!selectedBase) return [];

        const plans = selectedBase.productions || [];
        if (plans.length === 0) return [];

        const ownedCounts = new Map<string, number>();
        for (const baseBuilding of selectedBase.buildings) {
            if (baseBuilding.sectionType !== 'production') continue;
            ownedCounts.set(baseBuilding.buildingTypeId, (ownedCounts.get(baseBuilding.buildingTypeId) || 0) + 1);
        }

        const buildingById = new Map(buildings.map((building) => [building.id, building]));
        const requirementsByBuilding = new Map<string, BuildingCoverageRow>();

        for (const plan of plans) {
            for (const requiredBuilding of plan.requiredBuildings || []) {
                const building = buildingById.get(requiredBuilding.buildingId);
                if (!building || !isBuildingAvailableForSection(building, 'production')) continue;

                const existing = requirementsByBuilding.get(requiredBuilding.buildingId);
                if (existing) {
                    existing.perPlan[plan.id] = requiredBuilding.count;
                    existing.totalRequired += requiredBuilding.count;
                    continue;
                }

                requirementsByBuilding.set(requiredBuilding.buildingId, {
                    buildingId: requiredBuilding.buildingId,
                    building,
                    perPlan: { [plan.id]: requiredBuilding.count },
                    totalRequired: requiredBuilding.count,
                    covered: 0,
                    owned: 0,
                    missing: 0,
                });
            }
        }

        return Array.from(requirementsByBuilding.values())
            .map((row) => {
                const owned = ownedCounts.get(row.buildingId) || 0;
                const covered = Math.min(row.totalRequired, owned);
                const missing = Math.max(0, row.totalRequired - owned);
                return { ...row, covered, owned, missing };
            })
            .sort((left, right) => right.totalRequired - left.totalRequired);
    });
};
