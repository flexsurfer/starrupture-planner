import { createTranslator, translateText } from '@/shared/i18n/core';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBuildingsModule } from '@/features/buildings/module';
import { registerItemsModule } from '@/features/items/module';
import { registerAppShellModule } from '@/features/app-shell/module';
import { registerPlannerModule } from './module';
import { createPlannerTab } from './state';
import { buildMultiTargetProductionFlow, buildProductionFlow } from './production-flow';
import { getMultiTargetWarning } from './target-conflicts';
import { getFlowNodeId } from './flow-node';
import type { Building, FlowNode } from './types';

const buildings: Building[] = [{
    id: 'factory', name: 'Factory', power: 10,
    recipes: [
        { output: { id: 'ore', amount_per_minute: 60 }, inputs: [] },
        { output: { id: 'plate', amount_per_minute: 20 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] },
        { output: { id: 'a', amount_per_minute: 10 }, inputs: [{ id: 'plate', amount_per_minute: 10 }] },
        { output: { id: 'b', amount_per_minute: 10 }, inputs: [{ id: 'plate', amount_per_minute: 10 }] },
        { variant: 'alternative', output: { id: 'b', amount_per_minute: 10 }, inputs: [{ id: 'a', amount_per_minute: 10 }] },
        { output: { id: 'c', amount_per_minute: 10 }, inputs: [{ id: 'a', amount_per_minute: 10 }] },
    ],
}];

describe('multi-target planner tabs', () => {
    it.each(['a', 'missing'])('waits for game data before validating restored target %s', itemId => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerAppShellModule);
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerPlannerModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            plannerTabs: [{
                ...createPlannerTab('saved', 'Saved plan', 'multi'),
                multiTargets: [{ itemId, amount: 10 }],
            }],
            plannerActiveTabId: 'saved',
        });
        try {
            const warning = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING]);
            expect(warning()).toBeNull();
            harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', {
                buildings, items: [], corporations: {},
            }]);
            if (itemId === 'missing') {
                expect(translateText(createTranslator('en'), warning() ?? '')).toContain('missing has no usable production recipe');
                expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]).nodes).toEqual([]);
            } else {
                expect(warning()).toBeNull();
                expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]).nodes.length).toBeGreaterThan(0);
            }
        } finally {
            runtime.dispose();
        }
    });

    it('shares production capacity and rounds combined building counts', () => {
        const flow = buildMultiTargetProductionFlow([{ itemId: 'a', amount: 10 }, { itemId: 'b', amount: 10 }], buildings);
        const plate = flow.nodes.filter((n): n is FlowNode => n.nodeType === 'production').filter(n => n.outputItem === 'plate');
        expect(plate).toHaveLength(1);
        expect(plate[0].buildingCount).toBe(1);
        expect(plate[0].totalPower).toBe(10);
        expect(flow.edges.filter(e => e.itemId === 'plate').map(e => e.amount)).toEqual([10, 10]);
        expect(flow.nodes.some(n => n.nodeType === 'launcher')).toBe(false);
        expect(flow.nodes.some(n => n.nodeType === 'target')).toBe(false);
        const single = buildProductionFlow({ targetItemId: 'a', targetAmount: 10 }, buildings);
        const multi = buildMultiTargetProductionFlow([{ itemId: 'a', amount: 10 }], buildings);
        expect(multi).toEqual(single);
        expect(buildMultiTargetProductionFlow([], buildings).nodes).toEqual([]);
        expect(buildMultiTargetProductionFlow([{ itemId: 'a', amount: NaN }], buildings).nodes).toEqual([]);
    });

    it.each([false, true])('fulfills nested target demand independently of target order (reversed: %s)', reversed => {
        const targets = [{ itemId: 'plate', amount: 5 }, { itemId: 'a', amount: 10 }, { itemId: 'c', amount: 10 }];
        const flow = buildMultiTargetProductionFlow(reversed ? [...targets].reverse() : targets, buildings);
        const producers = flow.nodes.filter((node): node is FlowNode => node.nodeType === 'production');
        expect(Object.fromEntries(producers.map(node => [node.outputItem, node.outputAmount * node.buildingCount])))
            .toEqual({ ore: 37.5, plate: 25, a: 20, c: 10 });
        expect(producers.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0)).toBe(6);
        expect(producers.reduce((sum, node) => sum + node.totalPower, 0)).toBe(60);
        for (const target of targets.filter(target => target.itemId !== 'c')) {
            const id = `target:${target.itemId}`;
            expect(flow.nodes.find(node => getFlowNodeId(node) === id))
                .toEqual({ nodeType: 'target', outputItem: target.itemId, amount: target.amount });
            expect(flow.edges.filter(edge => edge.to === id)).toHaveLength(1);
            expect(flow.edges.find(edge => edge.to === id)).toMatchObject({ itemId: target.itemId, amount: target.amount });
            expect(flow.edges.some(edge => edge.from === id)).toBe(false);
        }
        expect(flow.nodes.some(node => getFlowNodeId(node) === 'target:c')).toBe(false);
        // Nested targets have explicit demand edges; the terminal target keeps its original producer.
        for (const producer of producers) {
            const outgoing = flow.edges.filter(edge => edge.from === getFlowNodeId(producer));
            if (producer.outputItem === 'c') {
                expect(outgoing).toEqual([]);
                continue;
            }
            expect(outgoing.reduce((sum, edge) => sum + edge.amount, 0))
                .toBeCloseTo(producer.outputAmount * producer.buildingCount);
        }
    });

    it('adds and removes only the nested endpoint when recipes or targets change', () => {
        const targets = [{ itemId: 'a', amount: 10 }, { itemId: 'b', amount: 10 }];
        const independent = buildMultiTargetProductionFlow(targets, buildings);
        expect(independent.nodes.some(node => node.nodeType === 'target')).toBe(false);
        const nested = buildMultiTargetProductionFlow(targets, buildings, { b: 'factory:4' });
        expect(nested.nodes.filter(node => node.nodeType === 'target')).toEqual([
            { nodeType: 'target', outputItem: 'a', amount: 10 },
        ]);
        expect(buildMultiTargetProductionFlow(targets, buildings, {})).toEqual(independent);
        expect(buildMultiTargetProductionFlow([targets[0]], buildings, { b: 'factory:4' }))
            .toEqual(buildProductionFlow({ targetItemId: 'a', targetAmount: 10 }, buildings));
    });

    it('allows dependencies in both directions and through selected alternatives', () => {
        expect(getMultiTargetWarning(['a', 'b'], buildings, {}, [])).toBeNull();
        expect(getMultiTargetWarning(['plate', 'c'], buildings, {}, [])).toBeNull();
        expect(getMultiTargetWarning(['c', 'plate'], buildings, {}, [])).toBeNull();
        expect(getMultiTargetWarning(['a', 'b'], buildings, { b: 'factory:4' }, [])).toBeNull();
    });

    it('merges repeated demands passed directly to the calculator into one target endpoint', () => {
        const flow = buildMultiTargetProductionFlow([{ itemId: 'a', amount: 2.5 }, { itemId: 'a', amount: 7.5 }, { itemId: 'c', amount: 10 }], buildings);
        expect(flow.nodes.filter(node => node.nodeType === 'target')).toEqual([
            { nodeType: 'target', outputItem: 'a', amount: 10 },
        ]);
        expect(flow.edges.filter(edge => edge.to === 'target:a')).toEqual([
            { from: 'factory_2_a', to: 'target:a', itemId: 'a', amount: 10 },
        ]);
    });

    it('does not add demand for invalid or raw targets already used as ingredients', () => {
        const flow = buildMultiTargetProductionFlow([
            { itemId: 'a', amount: NaN }, { itemId: 'plate', amount: -5 },
            { itemId: 'ore', amount: 60 }, { itemId: 'c', amount: 10 },
        ], buildings);
        expect(flow).toEqual(buildProductionFlow({ targetItemId: 'c', targetAmount: 10 }, buildings));
    });

    it('warns about actual recipe cycles, including cycles below a target', () => {
        const cyclicBuildings = structuredClone(buildings);
        cyclicBuildings[0].recipes!.push({
            variant: 'alternative', output: { id: 'a', amount_per_minute: 10 }, inputs: [{ id: 'b', amount_per_minute: 10 }],
        });
        const selections = { a: 'factory:6', b: 'factory:4' };
        expect(translateText(createTranslator('en'), getMultiTargetWarning(['a', 'b'], cyclicBuildings, selections, []) ?? '')).toContain('circular production dependency');
        expect(translateText(createTranslator('en'), getMultiTargetWarning(['c'], cyclicBuildings, selections, []) ?? '')).toContain('circular production dependency');
        expect(getMultiTargetWarning(['c'], cyclicBuildings, { a: 'factory:6' }, [])).toBeNull();
    });

    it('accepts overlapping additions and recipe changes while preserving tabs and updating stats', () => {
        const runtime = createAppRuntime();
        runtime.registerModule(registerBuildingsModule);
        runtime.registerModule(registerItemsModule);
        runtime.registerModule(registerPlannerModule);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(), buildingsList: buildings,
            itemsList: ['ore', 'plate', 'a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), type: id === 'ore' ? 'raw' : 'component' })),
        });
        try {
            harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'c']);
            harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'single', 'Single plan', 'single']);
            harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'multi', 'Multi plan', 'multi']);
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'a']);
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'b']);
            const targets = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MULTI_TARGETS]);
            expect(targets()).toHaveLength(2);
            const rates = () => Object.fromEntries(
                [...harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]).itemsByType.values()]
                    .flat().map(item => [item.id, item.requiredRate]),
            );
            expect(rates()).toEqual({ ore: 30, plate: 20, a: 10, b: 10 });
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]).productionGroups[0].nodes)
                .toHaveLength(2);
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'plate']);
            expect(targets()).toHaveLength(3);
            expect(harness.getState().plannerTargetWarning).toBeNull();
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'c']);
            expect(targets()).toHaveLength(4);
            expect(harness.getState().plannerTargetWarning).toBeNull();
            expect(rates()).toEqual({ ore: 75, plate: 50, a: 20, b: 10, c: 10 });
            const stats = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]);
            expect(stats.productionGroups[0].nodes).toHaveLength(4);
            expect(Object.fromEntries(stats.productionGroups[0].nodes.map(node => [node.outputItem, node.nodeType])))
                .toEqual({ a: 'target', b: 'production', c: 'production', plate: 'target' });
            expect(stats.productionGroups.slice(1).flatMap(group => group.nodes)).toHaveLength(3);
            expect(stats.buildingStats).toEqual([{ buildingId: 'factory', buildingName: 'Factory', count: 9, totalPower: 90, totalHeat: 0 }]);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_SUMMARY]))
                .toEqual({ totalBuildings: 9, totalEnergy: 90, totalHotness: 0 });
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'a']);
            expect(translateText(createTranslator('en'), harness.getState().plannerTargetWarning ?? '')).toContain('already a target');
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'b', 'factory:4']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS])).toEqual({ b: 'factory:4' });
            expect(harness.getState().plannerTargetWarning).toBeNull();
            expect(rates()).toEqual({ ore: 75, plate: 50, a: 30, b: 10, c: 10 });
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTIONS, {}]);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS])).toEqual({});
            harness.dispatchSync([appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'a', 20]);
            expect(rates()).toEqual({ ore: 90, plate: 60, a: 30, b: 10, c: 10 });
            harness.dispatchSync([appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'a', Infinity]);
            expect(targets()[0].amount).toBe(20);
            harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'single']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS])).toEqual(['c']);
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'b', 'factory:4']);
            harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'multi']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RECIPE_SELECTIONS])).toEqual({});
            expect(targets()).toHaveLength(4);
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_TARGET, 'a']);
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'b', 'factory:4']);
            expect(harness.getState().plannerTargetWarning).toBeNull();
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS])).toEqual({ b: 'factory:4' });
            expect(rates()).toEqual({ ore: 60, plate: 40, a: 20, b: 10, c: 10 });
            const flow = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]);
            expect(flow.nodes.some(node => node.nodeType === 'target' && node.outputItem === 'a')).toBe(false);
            expect(flow.nodes.some(node => node.nodeType === 'production' && node.outputItem === 'a')).toBe(true);
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_TARGET, 'b']);
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_TARGET, 'plate']);
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_TARGET, 'c']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]).nodes).toEqual([]);
        } finally {
            runtime.dispose();
        }
    });
});
