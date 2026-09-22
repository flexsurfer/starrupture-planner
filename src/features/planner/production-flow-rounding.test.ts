// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMultiTargetProductionFlow, buildProductionFlow } from './production-flow';
import type { Building, FlowNode } from './types';

const buildings = JSON.parse(readFileSync(
    new URL('../../../assets/game-data/update2_QoL/buildings_and_recipes.json', import.meta.url),
    'utf8',
)) as Building[];

const targets = [
    { itemId: 'tube', amount: 120 },
    { itemId: 'rotor', amount: 20 },
    { itemId: 'basic_building', amount: 300 },
    { itemId: 'powder_wolfram', amount: 90 },
    { itemId: 'stabilizer', amount: 20 },
    { itemId: 'stator', amount: 20 },
];

describe('shared production capacity rounding', () => {
    it.each([false, true])('uses two Wolfram Wire fabricators for 60/min (reversed: %s)', reversed => {
        const flow = buildMultiTargetProductionFlow(reversed ? [...targets].reverse() : targets, buildings);
        const wire = flow.nodes.find((node): node is FlowNode =>
            node.nodeType === 'production' && node.outputItem === 'wolfram_wire');

        expect(flow.edges.filter(edge => edge.itemId === 'wolfram_wire').map(edge => edge.amount).sort((a, b) => a - b))
            .toEqual([20, 40]);
        expect(wire).toMatchObject({ outputAmount: 30, buildingCount: 2, totalPower: 20, totalHeat: 10 });
    });

    it('still requires a third building when demand actually exceeds 60/min', () => {
        const flow = buildMultiTargetProductionFlow(targets.map(target =>
            target.itemId === 'stator' ? { ...target, amount: 20.001 } : target), buildings);
        const wire = flow.nodes.find((node): node is FlowNode =>
            node.nodeType === 'production' && node.outputItem === 'wolfram_wire');

        expect(wire).toBeDefined();
        expect(Math.ceil(wire!.buildingCount)).toBe(3);
        expect(wire!.outputAmount * wire!.buildingCount).toBeCloseTo(60.001, 6);
        expect(wire).toMatchObject({ totalPower: 30, totalHeat: 15 });
    });

    it('rounds shared capacity once for a single target with several dependency branches', () => {
        const sharedBuildings: Building[] = [{
            id: 'factory', name: 'Factory', power: 10, heat: 5,
            recipes: [
                { output: { id: 'wire', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 15 }] },
                ...['a', 'b', 'c'].map(id => ({
                    output: { id, amount_per_minute: 20 }, inputs: [{ id: 'wire', amount_per_minute: 20 }],
                })),
                {
                    output: { id: 'product', amount_per_minute: 20 },
                    inputs: ['a', 'b', 'c'].map(id => ({ id, amount_per_minute: 20 })),
                },
            ],
        }];
        const flow = buildProductionFlow({ targetItemId: 'product', targetAmount: 20 }, sharedBuildings);

        expect(flow.nodes.find(node => node.outputItem === 'wire'))
            .toMatchObject({ outputAmount: 30, buildingCount: 2, totalPower: 20, totalHeat: 10 });
    });
});
