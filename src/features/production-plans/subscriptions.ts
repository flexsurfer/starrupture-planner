import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, BaseBuilding, Building as DbBuilding, BuildingsByIdMap, Corporation, CorporationLevelSelection, Item, Production } from '@/app/uklad/model';
import type { BuildingRequirement, InputRequirement, ProductionPlanRequirementsStatus, ProductionPlanSectionStats, ProductionPlanSectionViewModel, SharedInputShortage } from '@/components/mybases/types';
import type { ProductionFlowResult } from '@/components/planner/core/types';
import { buildProductionFlow } from '@/components/planner/core/productionFlowBuilder';
import { buildActivePlanOccupancy } from '@/components/mybases/utils/activePlanOccupancy';
import { calculateSharedInputShortages } from '@/components/mybases/utils/sharedInputShortages';
import { computeRequiredBuildings, getFlowInputBuildings, resolveInputBuilding, resolveLinkedOutput, sanitizeRecipeSelectionsForInputItems } from '@/utils/productionPlanInputs';

const EMPTY_PRODUCTION_FLOW: ProductionFlowResult = { nodes: [], edges: [], rawMaterialDeficits: [] };
const EMPTY_PRODUCTION_PLAN_SECTION_STATS: ProductionPlanSectionStats = { buildingCount: 0, totalHeat: 0, totalPowerConsumption: 0 };
const isLauncherEnabled = (corporationLevel?: CorporationLevelSelection | null): boolean => corporationLevel !== null && corporationLevel !== undefined;

export const registerProductionPlansSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS, () => [[appIds.subscriptions.BASES_SELECTED_BASE]], ([selectedBase], ..._params) => {
        void _params;
        return selectedBase ? selectedBase.productions.map((section) => section.id) : [];
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, (baseId, sectionId) => {
        void sectionId;
        return [[appIds.subscriptions.BASES_BASE_BY_ID, baseId]];
    }, ([base], _baseId, sectionId) => (base && sectionId ? base.productions.find((section) => section.id === sectionId) || null : null));

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, () => [[appIds.subscriptions.ITEMS_BY_ID_MAP]], ([itemsById], itemId) => (itemId ? itemsById[itemId]?.name || itemId : ''));

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, (baseId, sectionId) => [
        [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId],
        [appIds.subscriptions.BUILDINGS_LIST],
        [appIds.subscriptions.BASES_LIST],
    ], (values) => {
        const [section, buildings, allBases] = values as [Production | null, DbBuilding[], Base[]];
        if (!section || !section.selectedItemId) return EMPTY_PRODUCTION_FLOW;
        const inputBuildings = getFlowInputBuildings(section.inputs || [], allBases);
        return buildProductionFlow({
            targetItemId: section.selectedItemId,
            targetAmount: section.targetAmount > 0 ? section.targetAmount : 1,
            inputBuildings,
            rawProductionDisabled: true,
            includeLauncher: isLauncherEnabled(section.corporationLevel),
            recipeSelections: sanitizeRecipeSelectionsForInputItems(section.recipeSelections, inputBuildings),
        }, buildings);
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_STATS_BY_ID, (baseId, sectionId) => [
        [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId],
        [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId],
    ], (values) => {
        const [productionFlow, section] = values as [ProductionFlowResult, Production | null];
        if (!productionFlow || productionFlow.nodes.length === 0) return EMPTY_PRODUCTION_PLAN_SECTION_STATS;
        return {
            buildingCount: productionFlow.nodes.filter((node) => node.nodeType !== 'input').reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0) + (section?.inputs || []).length,
            totalHeat: productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0),
            totalPowerConsumption: productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0),
        };
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, (baseId, sectionId) => [
        [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId],
        [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId],
        [appIds.subscriptions.BASES_BASE_BY_ID, baseId],
        [appIds.subscriptions.BASES_LIST],
        [appIds.subscriptions.ITEMS_BY_ID_MAP],
        [appIds.subscriptions.BUILDINGS_LIST],
        [appIds.subscriptions.BUILDINGS_BY_ID_MAP],
        [appIds.subscriptions.CORPORATIONS_LIST],
    ], (values) => {
        const [section, productionFlow, base, allBases, itemsMap, buildings, buildingsById, corporations] = values as [Production | null, ProductionFlowResult, Base | null, Base[], Record<string, Item>, DbBuilding[], BuildingsByIdMap, Corporation[]];
        if (!base || !section) return null;
        const itemName = section.selectedItemId ? itemsMap[section.selectedItemId]?.name || section.selectedItemId : '';
        const corporationName = section.corporationLevel ? corporations.find((corporation) => corporation.id === section.corporationLevel?.corporationId)?.name || null : null;
        const requiredBuildings = productionFlow.nodes.length > 0 ? computeRequiredBuildings(productionFlow) : section.requiredBuildings || [];
        const sectionInputSnapshots = section.inputs || [];
        const sectionInputs = sectionInputSnapshots.map((input) => resolveInputBuilding(input, allBases));
        let totalHeat = 0;
        let totalPowerConsumption = 0;
        requiredBuildings.forEach(({ buildingId, count }) => {
            const building = buildingsById[buildingId];
            if (building) {
                totalHeat += (building.heat || 0) * count;
                totalPowerConsumption += (building.power || 0) * count;
            }
        });
        sectionInputs.forEach((inputBuilding: BaseBuilding) => {
            const building = buildingsById[inputBuilding.buildingTypeId];
            if (building) {
                totalHeat += building.heat || 0;
                totalPowerConsumption += building.power || 0;
            }
        });
        const stats: ProductionPlanSectionStats = { buildingCount: requiredBuildings.reduce((sum, building) => sum + building.count, 0) + sectionInputs.length, totalHeat, totalPowerConsumption };
        const occupancyFromOtherPlans = buildActivePlanOccupancy(base, { excludePlanId: section.id });
        const totalBuildingsMap = new Map<string, number>();
        base.buildings.forEach((baseBuilding) => totalBuildingsMap.set(baseBuilding.buildingTypeId, (totalBuildingsMap.get(baseBuilding.buildingTypeId) || 0) + 1));
        const buildingRequirements: BuildingRequirement[] = [];
        let allRequirementsSatisfied = true;
        requiredBuildings.forEach(({ buildingId, count }) => {
            const total = totalBuildingsMap.get(buildingId) || 0;
            const available = Math.max(0, total - (occupancyFromOtherPlans.occupiedBuildingTypeCounts.get(buildingId) || 0));
            const isSatisfied = available >= count;
            if (!isSatisfied) allRequirementsSatisfied = false;
            const building = buildingsById[buildingId];
            buildingRequirements.push({ buildingId, buildingName: building?.name || buildingId, required: count, available, isSatisfied });
        });
        buildingRequirements.sort((left, right) => left.isSatisfied !== right.isSatisfied ? (left.isSatisfied ? 1 : -1) : left.buildingName.localeCompare(right.buildingName));
        const baseBuildingsById = new Map(base.buildings.map((building) => [building.id, building]));
        const baseInputBuildingsById = new Map(base.buildings.filter((building) => building.sectionType === 'inputs' && !!building.selectedItemId && !!building.ratePerMinute && building.ratePerMinute > 0).map((building) => [building.id, building]));
        const inputRequirements: InputRequirement[] = [];
        let allInputsSatisfied = true;
        sectionInputSnapshots.forEach((inputBuilding: BaseBuilding) => {
            const resolvedInput = resolveInputBuilding(inputBuilding, allBases);
            const matchingBaseBuilding = baseBuildingsById.get(inputBuilding.id);
            const building = buildingsById[resolvedInput.buildingTypeId] || null;
            const itemId = resolvedInput.selectedItemId || inputBuilding.linkedOutput?.itemIdSnapshot || '';
            const item = itemId ? itemsMap[itemId] || { id: itemId, name: itemId, type: 'unknown' } : null;
            const ratePerMinute = resolvedInput.ratePerMinute || inputBuilding.linkedOutput?.ratePerMinuteSnapshot || 0;
            const linkedOutputResolution = inputBuilding.linkedOutput ? resolveLinkedOutput(inputBuilding, allBases) : null;
            const linkedOutputSourceBuilding = linkedOutputResolution?.sourceOutput ? buildingsById[linkedOutputResolution.sourceOutput.buildingTypeId] : null;
            const linkedOutputStatus = resolvedInput.linkedOutputStatus || linkedOutputResolution?.status;
            const isLinkedInputSatisfied = !!(inputBuilding.linkedOutput && matchingBaseBuilding && matchingBaseBuilding.sectionType === 'inputs' && matchingBaseBuilding.linkedOutput?.baseId === inputBuilding.linkedOutput.baseId && matchingBaseBuilding.linkedOutput?.buildingId === inputBuilding.linkedOutput.buildingId && linkedOutputStatus === 'ok' && building && item);
            const isManualInputSatisfied = !!(!inputBuilding.linkedOutput && matchingBaseBuilding && matchingBaseBuilding.sectionType === 'inputs' && matchingBaseBuilding.selectedItemId === inputBuilding.selectedItemId && matchingBaseBuilding.ratePerMinute === inputBuilding.ratePerMinute && building && item);
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
                linkedOutput: inputBuilding.linkedOutput ? { status: linkedOutputStatus || 'missing-output', baseName: linkedOutputResolution?.sourceBase?.name || 'Missing base', outputName: linkedOutputResolution?.sourceOutput?.name || linkedOutputSourceBuilding?.name || inputBuilding.linkedOutput.buildingId } : undefined,
            });
        });
        const sharedInputShortages: SharedInputShortage[] = calculateSharedInputShortages(base, section.id, buildings, allBases).map((shortage) => {
            const matchingBaseInput = baseInputBuildingsById.get(shortage.baseBuildingId);
            const itemId = shortage.itemId || matchingBaseInput?.selectedItemId || '';
            return { ...shortage, inputName: (matchingBaseInput?.name || '').trim() || (itemId ? itemsMap[itemId]?.name || itemId : 'Unknown input'), itemId, itemName: itemId ? itemsMap[itemId]?.name || itemId : 'Unknown input' };
        });
        const hasRawMaterialShortage = (productionFlow.rawMaterialDeficits || []).length > 0;
        const hasMaterialShortage = sharedInputShortages.length > 0 || hasRawMaterialShortage;
        const planStatus = section.status || (section.active ? 'active' : 'inactive');
        return { selectedBaseId: base.id, section, itemName, corporationName, stats, buildingRequirements, inputRequirements, sharedInputShortages, hasRawMaterialShortage, hasMaterialShortage, allRequirementsSatisfied, planStatus, hasError: planStatus === 'error' || !allInputsSatisfied, showManageButton: buildingRequirements.length > 0 || inputRequirements.length > 0 };
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, (baseId, sectionId) => [[appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, sectionId]], (values): ProductionPlanRequirementsStatus => {
        const [sectionData] = values as [ProductionPlanSectionViewModel | null];
        if (!sectionData) return { allRequirementsSatisfied: false, planStatus: 'inactive', hasError: false, hasMaterialShortage: false, itemName: '', corporationName: null };
        return { allRequirementsSatisfied: sectionData.allRequirementsSatisfied, planStatus: sectionData.planStatus, hasError: sectionData.hasError, hasMaterialShortage: sectionData.hasMaterialShortage, itemName: sectionData.itemName, corporationName: sectionData.corporationName };
    });
};
