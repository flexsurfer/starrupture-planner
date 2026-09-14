import { expect, it } from 'vitest';
import { buildProductionFlow } from '@/features/planner/production-flow';
import type { BaseBuilding, Building } from '@/app/uklad/model';
import { computeRequiredBuildings } from '@/utils/productionPlanInputs';
import { addDiagramInputRequirements } from './diagram-inputs';

const buildings: Building[] = [
    { id: 'smelter', name: 'Smelter', recipes: [
        { output: { id: 'bar', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] },
        { output: { id: 'bar', amount_per_minute: 30 }, inputs: [{ id: 'water', amount_per_minute: 90 }] },
    ] },
    { id: 'assembler', name: 'Assembler', recipes: [
        { output: { id: 'wire', amount_per_minute: 15 }, inputs: [{ id: 'bar', amount_per_minute: 30 }, { id: 'ore', amount_per_minute: 20 }] },
    ] },
];

it.each([0, 40, 80, 100])('connects only unmet demand to requirement cards with %s/min input supply', (supply) => {
    const inputBuildings: BaseBuilding[] = supply ? [{ id: 'ore-input', buildingTypeId: 'cargo', sectionType: 'inputs', selectedItemId: 'ore', ratePerMinute: supply }] : [];
    const flow = buildProductionFlow({ targetItemId: 'wire', targetAmount: 15, inputBuildings, rawProductionDisabled: true }, buildings);
    const original = structuredClone(flow);
    const requiredBuildings = computeRequiredBuildings(flow);
    const diagram = addDiagramInputRequirements(flow, buildings);
    expect(flow).toEqual(original);
    expect(computeRequiredBuildings(flow)).toEqual(requiredBuildings);

    if (supply >= 80) {
        expect(diagram.nodes).toEqual(flow.nodes);
        expect(diagram.edges).toEqual(flow.edges);
        expect(diagram.requirements.size).toBe(0);
        return;
    }

    expect(diagram.nodes).toHaveLength(flow.nodes.length + 1);
    expect(diagram.requirements.get('required-input:ore')).toMatchObject({ required: 80, available: supply, missing: 80 - supply });
    const newEdges = diagram.edges.slice(flow.edges.length);
    expect(newEdges.reduce((sum, edge) => sum + edge.amount, 0)).toBeCloseTo(80 - supply);
    for (const [to, expected] of [['smelter_0_bar', 60], ['assembler_0_wire', 20]] as const) {
        expect(diagram.edges.filter(edge => edge.to === to && edge.itemId === 'ore').reduce((sum, edge) => sum + edge.amount, 0)).toBeCloseTo(expected);
    }
    expect(diagram.nodes.filter(node => node.baseBuildingId === 'ore-input')).toEqual(flow.nodes.filter(node => node.baseBuildingId === 'ore-input'));
});

it('connects requirements from the selected alternative recipe', () => {
    const flow = buildProductionFlow({ targetItemId: 'wire', targetAmount: 15, rawProductionDisabled: true, recipeSelections: { bar: 'smelter:1' } }, buildings);
    const diagram = addDiagramInputRequirements(flow, buildings);
    expect([...diagram.requirements.keys()].sort()).toEqual(['required-input:ore', 'required-input:water']);
    expect(diagram.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ to: 'smelter_1_bar', itemId: 'water', amount: 90 }),
        expect.objectContaining({ to: 'assembler_0_wire', itemId: 'ore', amount: 20 }),
    ]));
});
