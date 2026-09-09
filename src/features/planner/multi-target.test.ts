import { createUkladTestHarness } from '@ukladjs/core/testing';
import { describe, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerBuildingsModule } from '@/features/buildings/module';
import { registerItemsModule } from '@/features/items/module';
import { registerPlannerModule } from './module';
import { buildMultiTargetProductionFlow, buildProductionFlow } from './production-flow';
import { findTargetConflict } from './target-conflicts';
import type { Building } from './types';

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

describe('global multi-target planner', () => {
    it('shares production capacity and rounds combined building counts', () => {
        const flow = buildMultiTargetProductionFlow([{ itemId: 'a', amount: 10 }, { itemId: 'b', amount: 10 }], buildings);
        const plate = flow.nodes.filter(n => n.outputItem === 'plate');
        expect(plate).toHaveLength(1);
        expect(plate[0].buildingCount).toBe(1);
        expect(plate[0].totalPower).toBe(10);
        expect(flow.edges.filter(e => e.itemId === 'plate').map(e => e.amount)).toEqual([10, 10]);
        expect(flow.nodes.some(n => n.nodeType === 'launcher')).toBe(false);
        expect(buildMultiTargetProductionFlow([{ itemId: 'a', amount: 10 }], buildings))
            .toEqual(buildProductionFlow({ targetItemId: 'a', targetAmount: 10 }, buildings));
        expect(buildMultiTargetProductionFlow([], buildings).nodes).toEqual([]);
        expect(buildMultiTargetProductionFlow([{ itemId: 'a', amount: NaN }], buildings).nodes).toEqual([]);
    });

    it('checks indirect dependencies in both directions and respects selected recipes', () => {
        expect(findTargetConflict(['a', 'b'], buildings, {})).toBeNull();
        expect(findTargetConflict(['plate', 'c'], buildings, {})).toEqual({ target: 'c', ingredient: 'plate' });
        expect(findTargetConflict(['c', 'plate'], buildings, {})).toEqual({ target: 'c', ingredient: 'plate' });
        expect(findTargetConflict(['a', 'b'], buildings, { b: 'factory:4' })).toEqual({ target: 'b', ingredient: 'a' });
    });

    it('rejects conflicting additions and recipe changes while preserving modes and updating stats', () => {
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
            harness.dispatchSync([appIds.events.PLANNER_SET_MODE, 'multi']);
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'a']);
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'b']);
            const targets = () => harness.getState().plannerMultiTargets;
            expect(targets()).toHaveLength(2);
            const rates = () => Object.fromEntries(
                [...harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]).itemsByType.values()]
                    .flat().map(item => [item.id, item.requiredRate]),
            );
            expect(rates()).toEqual({ ore: 30, plate: 20, a: 10, b: 10 });
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_DETAILED]).productionGroups[0].nodes)
                .toHaveLength(2);
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'plate']);
            expect(targets()).toHaveLength(2);
            expect(harness.getState().plannerTargetWarning).toContain('PLATE is required');
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'c']);
            expect(targets()).toHaveLength(2);
            expect(harness.getState().plannerTargetWarning).toContain('A is required');
            harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'a']);
            expect(harness.getState().plannerTargetWarning).toContain('already a target');
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'b', 'factory:4']);
            expect(harness.getState().plannerMultiRecipeSelections).toEqual({});
            expect(harness.getState().plannerTargetWarning).toContain('A is required to produce B');
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTIONS, { b: 'factory:4' }]);
            expect(harness.getState().plannerMultiRecipeSelections).toEqual({});
            harness.dispatchSync([appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'a', 20]);
            expect(rates()).toEqual({ ore: 45, plate: 30, a: 20, b: 10 });
            harness.dispatchSync([appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'a', Infinity]);
            expect(targets()[0].amount).toBe(20);
            harness.dispatchSync([appIds.events.PLANNER_SET_MODE, 'single']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS])).toEqual(['c']);
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'b', 'factory:4']);
            harness.dispatchSync([appIds.events.PLANNER_SET_MODE, 'multi']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RECIPE_SELECTIONS])).toEqual({});
            expect(targets()).toHaveLength(2);
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_TARGET, 'a']);
            harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTION, 'b', 'factory:4']);
            expect(harness.getState().plannerTargetWarning).toBeNull();
            expect(harness.getState().plannerMultiRecipeSelections).toEqual({ b: 'factory:4' });
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_TARGET, 'b']);
            expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_PRODUCTION_FLOW]).nodes).toEqual([]);
        } finally {
            runtime.dispose();
        }
    });
});
