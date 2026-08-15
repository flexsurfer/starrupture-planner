import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, BasesById, Building as DbBuilding, BuildingsByIdMap, Corporation, CreateProductionPlanModalState, Item } from '@/app/uklad/model';
import type { BaseInputItem, LinkableOutputItem } from '@/features/bases/types';
import type { CorporationLevelInfo, ProductionFlowResult, RawMaterialDeficitWithName } from '@/features/planner/types';
import { buildProductionFlow } from '@/features/planner/production-flow';
import { buildRecipeOptionsForOutputItems } from '@/features/planner/recipe-options';
import { collectConfiguredSectionItems } from '@/features/bases/derived-subscriptions';
import { isLogisticsExcludedOutputBuildingId } from '@/features/bases/building-section';
import { getItemName } from '@/utils/itemUtils';
import { getSelectedFlowInputBuildings, sanitizeRecipeSelectionsForInputItems } from '@/utils/productionPlanInputs';

const EMPTY_PRODUCTION_FLOW: ProductionFlowResult = { nodes: [], edges: [], rawMaterialDeficits: [] };
const isLauncherEnabled = (corporationLevel: CreateProductionPlanModalState['selectedCorporationLevel']): boolean => corporationLevel !== null && corporationLevel !== undefined;

export const registerProductionPlanModalSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE, stateKeys.productionPlanModalState);

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]], ([modalState], ..._params) => {
        void _params;
        return { isOpen: modalState.isOpen };
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]], ([modalState], ..._params) => {
        void _params;
        return { isEditMode: !!modalState.editSectionId };
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE], [appIds.subscriptions.ITEMS_LIST]], ([modalState, items], ..._params) => {
        void _params;
        const selectedItemName = modalState.selectedItemId ? items.find((item) => item.id === modalState.selectedItemId)?.name || '' : '';
        return { defaultName: modalState.name, currentSelectedItemId: modalState.selectedItemId, currentTargetAmount: modalState.targetAmount, defaultSelectedCorporationLevel: modalState.selectedCorporationLevel, selectedItemName, matchInputs: modalState.matchInputs };
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE], [appIds.subscriptions.BUILDINGS_LIST], [appIds.subscriptions.BASES_BY_ID_MAP]], ([modalState, buildings, basesById]: [CreateProductionPlanModalState, DbBuilding[], BasesById]) => {
        if (!modalState.selectedItemId) return EMPTY_PRODUCTION_FLOW;
        const base = modalState.baseId ? basesById[modalState.baseId] || null : null;
        const inputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], Object.values(basesById));
        return buildProductionFlow({
            targetItemId: modalState.selectedItemId,
            targetAmount: modalState.targetAmount > 0 ? modalState.targetAmount : 1,
            inputBuildings,
            rawProductionDisabled: true,
            includeLauncher: isLauncherEnabled(modalState.selectedCorporationLevel),
            recipeSelections: sanitizeRecipeSelectionsForInputItems(modalState.recipeSelections, inputBuildings),
        }, buildings);
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS, () => [
        [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE],
        [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW],
        [appIds.subscriptions.BUILDINGS_LIST],
        [appIds.subscriptions.ITEMS_BY_ID_MAP],
        [appIds.subscriptions.BASES_BY_ID_MAP],
    ], ([modalState, productionFlow, buildings, itemsById, basesById]: [CreateProductionPlanModalState, ProductionFlowResult, DbBuilding[], Record<string, Item>, BasesById]) => {
        if (!modalState.selectedItemId || !productionFlow.nodes.length) return [];
        const base = modalState.baseId ? basesById[modalState.baseId] || null : null;
        const inputItemIds = new Set(getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], Object.values(basesById)).map((input) => input.selectedItemId).filter((id): id is string => !!id));
        const outputItems = new Set<string>();
        productionFlow.nodes.forEach((node) => {
            if (node.nodeType === 'production' && !inputItemIds.has(node.outputItem)) outputItems.add(node.outputItem);
        });
        return buildRecipeOptionsForOutputItems(outputItems, buildings, itemsById, modalState.recipeSelections || {});
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS, () => [[appIds.subscriptions.CORPORATIONS_LIST], [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]], ([corporations, modalState]: [Corporation[], CreateProductionPlanModalState]) => {
        if (!modalState.selectedItemId) return [];
        const levels: CorporationLevelInfo[] = [];
        corporations.forEach((corporation) => corporation.levels.forEach((level) => level.components.forEach((component) => {
            if (component.id === modalState.selectedItemId) levels.push({ corporationName: corporation.name, corporationId: corporation.id, level: level.level, points: component.points, cost: component.cost });
        })));
        return levels;
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA, () => [[appIds.subscriptions.BASES_BY_ID_MAP], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP], [appIds.subscriptions.BASES_LIST], [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]], ([basesById, buildingsById, itemsMap, allBases, modalState]: [BasesById, BuildingsByIdMap, Record<string, Item>, Base[], CreateProductionPlanModalState]) => {
        if (!modalState.baseId || !basesById[modalState.baseId]) return { inputItems: [], selectedInputIds: [] };
        const inputItems: BaseInputItem[] = collectConfiguredSectionItems(basesById[modalState.baseId], buildingsById, itemsMap, 'inputs', allBases).map((entry) => ({ baseBuildingId: entry.baseBuildingId, item: entry.item, ratePerMinute: entry.ratePerMinute, building: entry.building, name: entry.name, description: entry.description, linkedOutput: entry.linkedOutput }));
        return { inputItems, selectedInputIds: modalState.selectedInputIds || [] };
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS, () => [[appIds.subscriptions.BASES_LIST], [appIds.subscriptions.BUILDINGS_BY_ID_MAP], [appIds.subscriptions.ITEMS_BY_ID_MAP], [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]], ([bases, buildingsById, itemsMap, modalState]: [Base[], BuildingsByIdMap, Record<string, Item>, CreateProductionPlanModalState]) => {
        const linkableOutputs: LinkableOutputItem[] = [];
        bases.forEach((base) => collectConfiguredSectionItems(base, buildingsById, itemsMap, 'outputs').forEach((entry) => {
            if (!isLogisticsExcludedOutputBuildingId(entry.building.id)) linkableOutputs.push({ baseId: base.id, baseName: base.name, isCurrentBase: base.id === modalState.baseId, baseBuildingId: entry.baseBuildingId, item: entry.item, ratePerMinute: entry.ratePerMinute, building: entry.building, name: entry.name, description: entry.description });
        }));
        return linkableOutputs.sort((left, right) => left.isCurrentBase !== right.isCurrentBase ? (left.isCurrentBase ? -1 : 1) : left.baseName.localeCompare(right.baseName) || left.item.name.localeCompare(right.item.name));
    });

    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE]], ([modalState]: [CreateProductionPlanModalState]) => modalState.selectedItemId);
    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW], [appIds.subscriptions.ITEMS_LIST]], ([productionFlow, items]: [ProductionFlowResult, Item[]]): RawMaterialDeficitWithName[] => (productionFlow.rawMaterialDeficits || []).map((deficit) => ({ ...deficit, itemName: getItemName(deficit.itemId, items) })));
    registrar.regSub(appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY, () => [[appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE], [appIds.subscriptions.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID]], ([modalState, selectedItemId]: [CreateProductionPlanModalState, string]) => !!(modalState.name.trim() && selectedItemId && modalState.targetAmount > 0));
};
