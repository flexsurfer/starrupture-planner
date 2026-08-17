// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import {
    createHeadlessE2EApp,
    type HeadlessE2EApp,
} from './e2e-support';

describe('headless bases and logistics E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = () => {
        const app = createHeadlessE2EApp();
        apps.push(app);
        return app;
    };

    afterEach(async () => {
        await Promise.all(apps.splice(0).map((app) => app.dispose()));
    });

    it('emulates every empty and missing base view', async () => {
        const app = createApp();
        const view = app.mountView('empty bases', {
            list: [appIds.subscriptions.BASES_LIST],
            collapsed: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS],
            selectedId: [appIds.subscriptions.BASES_SELECTED_BASE_ID],
            selectedTab: [appIds.subscriptions.BASES_SELECTED_DETAIL_TAB],
            byId: [appIds.subscriptions.BASES_BY_ID_MAP],
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
            missing: [appIds.subscriptions.BASES_BASE_BY_ID, 'missing'],
            missingCollapsed: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID, 'missing'],
            selectedStats: [appIds.subscriptions.BASES_SELECTED_BASE_DETAIL_STATS],
            missingStats: [appIds.subscriptions.BASES_DETAIL_STATS_BY_BASE_ID, 'missing'],
            missingLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, 'missing'],
            allLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS],
            allStats: [appIds.subscriptions.BASES_ALL_DETAIL_STATS],
            inputs: [appIds.subscriptions.BASES_INPUT_ITEMS_BY_BASE_ID, 'missing'],
            outputs: [appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, 'missing'],
            defense: [appIds.subscriptions.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, 'missing'],
            sectionBuildings: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, 'missing', 'production'],
            sectionStats: [appIds.subscriptions.BASES_BUILDING_SECTION_STATS, 'missing', 'production'],
            available: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'production'],
            coreLevels: [appIds.subscriptions.BASES_CORE_LEVELS],
            summary: [appIds.subscriptions.BASES_STATS_SUMMARY],
            groups: [appIds.subscriptions.ENERGY_GROUPS_LIST],
            groupsById: [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP],
            plans: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
            materials: [appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS],
            coverage: [appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
        } as const);

        expect(view.current()).toMatchObject({
            list: [],
            collapsed: {},
            selectedId: null,
            selectedTab: 'base',
            byId: {},
            selected: null,
            missing: null,
            missingCollapsed: {
                productionPlans: false,
                outputs: true,
                inputs: true,
                defense: true,
            },
            selectedStats: null,
            missingStats: null,
            missingLogistics: null,
            allLogistics: [],
            allStats: {},
            inputs: [],
            outputs: [],
            defense: [],
            sectionBuildings: [],
            sectionStats: {
                buildingCount: 0,
                totalHeat: 0,
                totalPowerGeneration: 0,
                totalPowerConsumption: 0,
                hasGenerators: false,
            },
            available: [],
            coreLevels: [{ level: 0, heatCapacity: 1000 }],
            groups: [],
            groupsById: {},
            plans: [],
            materials: [],
            coverage: [],
        });
        expect(view.value('summary')).toMatchObject({
            totalBases: 0,
            totalBuildings: 0,
            totalPlans: 0,
            totalHeat: 0,
            totalEnergyUsed: 0,
            totalEnergyProduced: 0,
        });
    });

    it('emulates multi-base creation, selection, tabs, collapsed defaults, editing, and deletion', async () => {
        const app = createApp();
        await app.seed();
        const root = app.mountView('base navigation', {
            list: [appIds.subscriptions.BASES_LIST],
            selectedId: [appIds.subscriptions.BASES_SELECTED_BASE_ID],
            selectedTab: [appIds.subscriptions.BASES_SELECTED_DETAIL_TAB],
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
            byId: [appIds.subscriptions.BASES_BY_ID_MAP],
            collapsed: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS],
        } as const);

        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Alpha']);
        const alphaId = root.value('selectedId')!;
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Beta']);
        const betaId = root.value('selectedId')!;
        expect(root.value('list').map(({ name }) => name)).toEqual(['Alpha', 'Beta']);

        const alpha = app.mountView('alpha navigation', {
            base: [appIds.subscriptions.BASES_BASE_BY_ID, alphaId],
            collapsed: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID, alphaId],
        } as const);

        await app.dispatch([appIds.events.BASES_UPDATE_BASE_NAME, 'missing', 'Ignored']);
        await app.dispatch([appIds.events.BASES_UPDATE_BASE_NAME, alphaId, 'Alpha Prime']);
        expect(alpha.value('base')?.name).toBe('Alpha Prime');

        await app.dispatch([appIds.events.BASES_OPEN_BASE, alphaId]);
        expect(root.current()).toMatchObject({ selectedId: alphaId, selectedTab: 'base' });
        await app.dispatch([appIds.events.BASES_OPEN_BASE, betaId, 'plans']);
        expect(root.current()).toMatchObject({ selectedId: betaId, selectedTab: 'plans' });
        await app.dispatch([appIds.events.BASES_SET_SELECTED_BASE, alphaId]);
        await app.dispatch([appIds.events.BASES_SET_DETAIL_TAB, 'buildings']);
        expect(root.current()).toMatchObject({ selectedId: alphaId, selectedTab: 'buildings' });

        await app.dispatch([appIds.events.BASES_SET_CORE_LEVEL, 2]);
        expect(alpha.value('base')?.coreLevel).toBe(2);

        await app.dispatch([
            appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED,
            'missing',
            'productionPlans',
        ]);
        expect(root.value('collapsed')).toEqual({});
        await app.dispatch([
            appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED,
            alphaId,
            'productionPlans',
        ]);
        await app.dispatch([
            appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED,
            alphaId,
            'outputs',
        ]);
        expect(alpha.value('collapsed')).toEqual({
            productionPlans: true,
            outputs: false,
            inputs: true,
            defense: true,
        });

        await app.dispatch([appIds.events.BASES_DELETE_BASE, betaId]);
        expect(root.value('list').map(({ id }) => id)).toEqual([alphaId]);
        expect(root.value('selectedId')).toBe(alphaId);

        await app.dispatch([appIds.events.BASES_DELETE_BASE, alphaId]);
        expect(root.current()).toMatchObject({ list: [], selectedId: null, selectedTab: 'base' });
        expect(root.value('collapsed')).toEqual({});
    });

    it('emulates building sections, bulk normalization, count reconciliation, stats, and removal guards', async () => {
        const app = createApp();
        await app.seed();
        const root = app.mountView('building root', {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
            selectedId: [appIds.subscriptions.BASES_SELECTED_BASE_ID],
            summary: [appIds.subscriptions.BASES_STATS_SUMMARY],
            selectedStats: [appIds.subscriptions.BASES_SELECTED_BASE_DETAIL_STATS],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Factory']);
        const baseId = root.value('selectedId')!;
        const sections = app.mountView('building sections', {
            production: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'production'],
            productionStats: [appIds.subscriptions.BASES_BUILDING_SECTION_STATS, baseId, 'production'],
            energy: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'energy'],
            energyStats: [appIds.subscriptions.BASES_BUILDING_SECTION_STATS, baseId, 'energy'],
            infrastructure: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'infrastructure'],
            defense: [appIds.subscriptions.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, baseId],
            productionChoices: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'production'],
            inputChoices: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'inputs'],
            energyChoices: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'energy'],
            outputChoices: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'outputs'],
            infrastructureChoices: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'infrastructure'],
            coreLevels: [appIds.subscriptions.BASES_CORE_LEVELS],
        } as const);

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'smelter',
            'production',
            2.9,
            'Iron line',
            'Smelting',
        ]);
        expect(sections.value('production')).toMatchObject([{
            buildingTypeId: 'smelter',
            count: 2,
            isGrouped: true,
        }]);

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'turret',
            'infrastructure',
            5,
        ]);
        expect(sections.value('defense')).toMatchObject([{ building: { id: 'turret' }, count: 1 }]);

        await app.dispatch([
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'smelter',
            'production',
            3,
        ]);
        expect(sections.value('production')[0]?.count).toBe(3);
        await app.dispatch([
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'smelter',
            'inputs',
            1,
        ]);
        await app.dispatch([
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'base_core',
            'production',
            1,
        ]);
        await app.dispatch([
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'ore_excavator',
            'production',
            1,
        ]);
        expect(sections.value('production')[0]?.count).toBe(3);

        await app.dispatch([
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'smelter',
            'production',
            1,
        ]);
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'power_generator',
            'energy',
            2,
        ]);
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'base_core_amplifier_v1',
            'energy',
        ]);
        await app.dispatch([appIds.events.BASES_ADD_BUILDING, baseId, 'habitat', 'infrastructure']);
        expect(sections.value('productionStats')).toMatchObject({ buildingCount: 1, totalHeat: 5 });
        expect(sections.value('energyStats')).toMatchObject({
            buildingCount: 3,
            totalHeat: 4,
            totalPowerGeneration: 200,
            hasGenerators: true,
        });
        expect(sections.value('coreLevels')).toHaveLength(3);
        expect(sections.value('productionChoices').map(({ id }) => id)).toContain('smelter');
        expect(sections.value('inputChoices').map(({ id }) => id)).toContain('ore_excavator');
        expect(sections.value('energyChoices').map(({ id }) => id)).toContain('power_generator');
        expect(sections.value('outputChoices').map(({ id }) => id)).toContain('package_dispatcher');
        expect(sections.value('infrastructureChoices').map(({ id }) => id)).toContain('turret');

        expect(root.value('summary')).toMatchObject({ totalBases: 1, totalBuildings: 6 });
        expect(root.value('selectedStats')).toMatchObject({
            baseName: 'Factory',
            buildingCount: 6,
            baseCoreHeatCapacity: 150,
        });

        const smelterId = root.value('selected')!.buildings.find(({ buildingTypeId }) => (
            buildingTypeId === 'smelter'
        ))!.id;
        await app.dispatch([appIds.events.BASES_SET_SELECTED_BASE, null]);
        await app.dispatch([appIds.events.BASES_REMOVE_BUILDING, smelterId]);
        expect(root.value('selected')).toBeNull();
        await app.dispatch([appIds.events.BASES_SET_SELECTED_BASE, baseId]);
        expect(root.value('selected')!.buildings.some(({ id }) => id === smelterId)).toBe(true);
        await app.dispatch([appIds.events.BASES_REMOVE_BUILDING, smelterId]);
        expect(sections.value('production')).toEqual([]);
    });

    it('emulates energy-group validation, duplicate reuse, assignment, rename conflicts, and deletion', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('energy groups', {
            bases: [appIds.subscriptions.BASES_LIST],
            groups: [appIds.subscriptions.ENERGY_GROUPS_LIST],
            groupsById: [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP],
        } as const);
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Alpha']);
        const alphaId = view.value('bases')[0]!.id;
        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Beta']);
        const betaId = view.value('bases')[1]!.id;

        await app.dispatch([appIds.events.ENERGY_GROUP_CREATE, '   ']);
        expect(view.value('groups')).toEqual([]);

        await app.dispatch([appIds.events.ENERGY_GROUP_CREATE, '  Main   Grid ', alphaId]);
        const mainId = view.value('groups')[0]!.id;
        await app.dispatch([appIds.events.ENERGY_GROUP_CREATE, 'main grid', betaId]);
        expect(view.value('groups')).toHaveLength(1);
        expect(view.value('bases')).toMatchObject([
            { id: alphaId, energyGroupId: mainId },
            { id: betaId, energyGroupId: mainId },
        ]);

        await app.dispatch([appIds.events.ENERGY_GROUP_CREATE, 'Backup']);
        const backupId = view.value('groups').find(({ name }) => name === 'Backup')!.id;
        await app.dispatch([appIds.events.ENERGY_GROUP_RENAME, mainId, '   ']);
        await app.dispatch([appIds.events.ENERGY_GROUP_RENAME, mainId, ' backup ']);
        expect(view.value('groupsById')[mainId]?.name).toBe('Main Grid');
        await app.dispatch([appIds.events.ENERGY_GROUP_RENAME, mainId, ' Primary   Grid ']);
        expect(view.value('groupsById')[mainId]?.name).toBe('Primary Grid');

        await app.dispatch([appIds.events.BASES_SET_ENERGY_GROUP, alphaId, 'missing']);
        expect(view.value('bases')[0]?.energyGroupId).toBe(mainId);
        await app.dispatch([appIds.events.BASES_SET_ENERGY_GROUP, alphaId, null]);
        expect(view.value('bases')[0]?.energyGroupId).toBeUndefined();
        await app.dispatch([appIds.events.BASES_SET_ENERGY_GROUP, alphaId, backupId]);
        expect(view.value('bases')[0]?.energyGroupId).toBe(backupId);

        await app.dispatch([appIds.events.ENERGY_GROUP_DELETE, 'missing']);
        expect(view.value('groups')).toHaveLength(2);
        await app.dispatch([appIds.events.ENERGY_GROUP_DELETE, mainId]);
        expect(view.value('groups').map(({ id }) => id)).toEqual([backupId]);
        expect(view.value('bases')[1]?.energyGroupId).toBeUndefined();
    });

    it('emulates cross-base manual outputs, exclusive input links, relinking, and broken-link views', async () => {
        const app = createApp();
        await app.seed();
        const root = app.mountView('logistics root', {
            bases: [appIds.subscriptions.BASES_LIST],
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
            allLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS],
        } as const);

        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Source']);
        const sourceId = root.value('selected')!.id;
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            sourceId,
            'package_dispatcher',
            'outputs',
            1,
            'Iron export',
            undefined,
            'iron-plate',
            60,
        ]);
        const outputId = root.value('selected')!.buildings[0]!.id;

        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Target']);
        const targetId = root.value('selected')!.id;
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            targetId,
            'package_receiver',
            'inputs',
            1,
            'Primary intake',
            undefined,
            'copper-wire',
            30,
        ]);
        let targetBase = root.value('selected')!;
        const firstInputId = targetBase.buildings[0]!.id;
        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            targetId,
            firstInputId,
            sourceId,
            outputId,
        ]);

        const detail = app.mountView('linked logistics', {
            inputs: [appIds.subscriptions.BASES_INPUT_ITEMS_BY_BASE_ID, targetId],
            outputs: [appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, sourceId],
            sourceLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, sourceId],
            targetLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, targetId],
        } as const);
        expect(detail.value('inputs')).toMatchObject([{
            baseBuildingId: firstInputId,
            item: { id: 'iron-plate' },
            ratePerMinute: 60,
            linkedOutput: { status: 'ok', baseId: sourceId, buildingId: outputId },
        }]);
        expect(detail.value('sourceLogistics')).toMatchObject({
            outputs: [{ baseBuildingId: outputId, linkedInputs: [{ baseBuildingId: firstInputId }] }],
        });

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDING,
            targetId,
            'package_receiver',
            'inputs',
            'Replacement intake',
        ]);
        targetBase = root.value('selected')!;
        const secondInputId = targetBase.buildings.find(({ name }) => name === 'Replacement intake')!.id;
        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            targetId,
            secondInputId,
            sourceId,
            outputId,
        ]);
        targetBase = root.value('selected')!;
        expect(targetBase.buildings.find(({ id }) => id === firstInputId)?.linkedOutput).toBeUndefined();
        expect(targetBase.buildings.find(({ id }) => id === secondInputId)).toMatchObject({
            selectedItemId: 'iron-plate',
            ratePerMinute: 60,
            linkedOutput: { baseId: sourceId, buildingId: outputId },
        });

        await app.dispatch([appIds.events.BASES_ADD_BUILDING, targetId, 'ore_excavator', 'inputs']);
        const extractorId = root.value('selected')!.buildings.find(({ buildingTypeId }) => (
            buildingTypeId === 'ore_excavator'
        ))!.id;
        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            targetId,
            extractorId,
            sourceId,
            outputId,
        ]);
        expect(root.value('selected')!.buildings.find(({ id }) => id === extractorId)?.linkedOutput).toBeUndefined();

        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            targetId,
            secondInputId,
            'copper-wire',
            20,
        ]);
        expect(root.value('selected')!.buildings.find(({ id }) => id === secondInputId)).toMatchObject({
            selectedItemId: 'copper-wire',
            ratePerMinute: 20,
        });
        expect(root.value('selected')!.buildings.find(({ id }) => id === secondInputId)?.linkedOutput).toBeUndefined();

        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            targetId,
            secondInputId,
            sourceId,
            'missing-output',
        ]);
        expect(root.value('selected')!.buildings.find(({ id }) => id === secondInputId)?.linkedOutput).toBeUndefined();

        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            targetId,
            secondInputId,
            sourceId,
            outputId,
        ]);
        await app.dispatch([appIds.events.BASES_DELETE_BASE, sourceId]);
        expect(detail.value('inputs').find(({ baseBuildingId }) => baseBuildingId === secondInputId)).toMatchObject({
            item: { id: 'iron-plate' },
            linkedOutput: { status: 'missing-base' },
        });
        expect(detail.value('sourceLogistics')).toBeNull();
        expect(detail.value('targetLogistics')).toMatchObject({
            incomingInputs: expect.arrayContaining([
                expect.objectContaining({ baseBuildingId: secondInputId, linkedOutputStatus: 'missing-base' }),
            ]),
        });
        expect(root.value('allLogistics')).toHaveLength(1);
    });

    it('emulates bulk output normalization, add-time linking, exclusive replacement, and clearing', async () => {
        const app = createApp();
        await app.seed();
        const view = app.mountView('bulk-linked base', {
            selected: [appIds.subscriptions.BASES_SELECTED_BASE],
        } as const);

        await app.dispatch([appIds.events.BASES_CREATE_BASE, 'Integrated logistics']);
        const baseId = view.value('selected')!.id;
        await app.dispatch([
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'package_receiver',
            'inputs',
            'Original receiver',
        ]);
        const originalInputId = view.value('selected')!.buildings[0]!.id;

        await app.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await app.dispatchAll([
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Exported iron'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT],
        ]);
        const planId = view.value('selected')!.productions[0]!.id;

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_dispatcher',
            'outputs',
            1,
            'Plan dispatcher',
            undefined,
            undefined,
            undefined,
            undefined,
            planId,
            'fixed',
            -1,
            Number.NaN,
            -1,
            { baseId, buildingId: originalInputId },
        ]);
        const planOutput = view.value('selected')!.buildings.find(({ name }) => (
            name === 'Plan dispatcher'
        ))!;
        expect(planOutput).toMatchObject({
            selectedItemId: 'iron-plate',
            sourceProductionId: planId,
            allocationMode: 'fixed',
            priority: 0,
        });
        expect(planOutput.requestedRatePerMinute).toBeUndefined();
        expect(planOutput.capacityPerMinute).toBeGreaterThan(0);
        expect(view.value('selected')!.buildings.find(({ id }) => id === originalInputId)).toMatchObject({
            selectedItemId: 'iron-plate',
            linkedOutput: { baseId, buildingId: planOutput.id },
        });

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_dispatcher',
            'outputs',
            1,
            'Second plan dispatcher',
            undefined,
            undefined,
            undefined,
            undefined,
            planId,
            'auto',
            undefined,
            Number.NaN,
            -1,
        ]);
        expect(view.value('selected')!.buildings.find(({ name }) => (
            name === 'Second plan dispatcher'
        ))).toMatchObject({
            sourceProductionId: planId,
            allocationMode: 'auto',
            priority: 1,
        });

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'inputs',
            1,
            'Replacement receiver',
            undefined,
            'iron-plate',
            60,
            {
                baseId,
                buildingId: planOutput.id,
                itemIdSnapshot: 'iron-plate',
                ratePerMinuteSnapshot: 60,
            },
        ]);
        const replacementInput = view.value('selected')!.buildings.find(({ name }) => (
            name === 'Replacement receiver'
        ))!;
        expect(view.value('selected')!.buildings.find(({ id }) => id === originalInputId)?.linkedOutput).toBeUndefined();
        expect(replacementInput.linkedOutput).toMatchObject({ baseId, buildingId: planOutput.id });

        await app.dispatch([
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            baseId,
            replacementInput.id,
            null,
            null,
        ]);
        expect(view.value('selected')!.buildings.find(({ id }) => id === replacementInput.id)).not.toMatchObject({
            selectedItemId: expect.anything(),
            ratePerMinute: expect.anything(),
            linkedOutput: expect.anything(),
        });

        await app.dispatch([
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'package_dispatcher',
            'outputs',
            'Defaulted dispatcher',
        ]);
        const defaultedOutput = view.value('selected')!.buildings.find(({ name }) => (
            name === 'Defaulted dispatcher'
        ))!;
        await app.dispatch([
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            defaultedOutput.id,
            {
                sourceProductionId: planId,
                allocationMode: 'auto',
                capacityPerMinute: Number.NaN,
                priority: -1,
            },
        ]);
        expect(view.value('selected')!.buildings.find(({ id }) => id === defaultedOutput.id)).toMatchObject({
            selectedItemId: 'iron-plate',
            sourceProductionId: planId,
            allocationMode: 'auto',
            priority: 3,
        });
        expect(view.value('selected')!.buildings.find(({ id }) => (
            id === defaultedOutput.id
        ))!.capacityPerMinute).toBeGreaterThan(0);
    });
});
