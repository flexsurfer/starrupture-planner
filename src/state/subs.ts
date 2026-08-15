import { SUB_IDS } from './sub-ids';
import type { UkladContracts, UkladRegistrar } from '@ukladjs/core/vanilla';
import type {
    Item,
    Corporation,
    Building as DbBuilding,
    BuildingsByIdMap,
    Base,
    BasesById,
    BaseBuilding,
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
import {
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
import type {
    LinkableOutputItem,
    ProductionPlanSectionStats,
    BuildingRequirement,
    InputRequirement,
    SharedInputShortage,
    ProductionPlanSectionViewModel,
} from '../components/mybases/types';
import { collectConfiguredSectionItems } from '@/features/bases/derived-subscriptions';

export const registerSubscriptions = (registrar: UkladRegistrar<UkladContracts>) => {
//============================================================
// Root subscriptions
//============================================================

//============================================================
// Energy Groups subscriptions
//============================================================
//============================================================
// Production Plan subscriptions
//============================================================
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

};
