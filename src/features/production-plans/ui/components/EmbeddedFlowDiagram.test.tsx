import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ReactFlowProps } from '@xyflow/react';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { FlowNode, ProductionFlowResult } from '@/features/planner/types';
import { ProductionFlowEdge } from '@/features/planner/ui/visualization/ProductionFlowEdge';
import { EmbeddedFlowDiagram } from './EmbeddedFlowDiagram';
import { ProductionPlanSection } from './ProductionPlanSection';

const { fitView, dispatch } = vi.hoisted(() => ({ fitView: vi.fn(), dispatch: vi.fn() }));
let diagramProps: ReactFlowProps;
vi.mock('@xyflow/react', async (importOriginal) => ({
    ...await importOriginal<typeof import('@xyflow/react')>(),
    useReactFlow: () => ({ fitView }),
    ReactFlow: (props: ReactFlowProps) => {
        diagramProps = props;
        return <>{props.nodes?.map(node => <div key={node.id} data-testid={node.id}>
            {node.data.label as ReactNode}
        </div>)}</>;
    },
    Background: () => null,
    Controls: () => null,
}));
vi.mock('@/features/planner/ui/visualization/NodeCard', () => ({
    NodeCard: ({ node }: { node: FlowNode }) => <span>{node.outputItem}</span>,
}));
vi.mock('../modals', () => ({ BuildingRequirementsModal: () => null }));
vi.mock('@/app/uklad/bindings', () => ({
    useRuntime: () => ({ dispatch }),
    useSubscription: ([id]: [string]) => {
        switch (id) {
            case appIds.subscriptions.UI_THEME: return 'dark';
            case appIds.subscriptions.ITEMS_LIST: return items;
            case appIds.subscriptions.BASES_LIST: return [];
            case appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID: return productionFlow;
            case appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID: return {
                selectedBaseId: 'base',
                section: { id: 'plan', name: 'Plate plan', targetAmount: 60, active: false },
                itemName: 'Plate', stats: { buildingCount: 1, totalHeat: 0, totalPowerConsumption: 0 },
                buildingRequirements: [], inputRequirements: [], sharedInputShortages: [],
                allRequirementsSatisfied: true,
            };
        }
    },
}));

const items = [
    { id: 'ore', name: 'Ore', type: 'raw' },
    { id: 'plate', name: 'Plate', type: 'processed' },
    { id: 'water', name: 'Water', type: 'raw' },
];
const productionFlow: ProductionFlowResult = {
    nodes: ['ore', 'plate', 'water'].map((outputItem, index) => ({
        nodeType: index === 1 ? 'production' : 'input',
        buildingId: index === 1 ? 'smelter' : 'cargo', buildingName: 'Building', recipeIndex: 0,
        baseBuildingId: index === 1 ? undefined : `input-${index}`,
        outputItem, outputAmount: 60, buildingCount: 1,
        powerPerBuilding: 0, heatPerBuilding: 0, totalPower: 0, totalHeat: 0,
    })),
    edges: [{ from: 'cargo_0_ore_input-0', to: 'smelter_0_plate', itemId: 'ore', amount: 60 }],
    rawMaterialDeficits: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('uses the new edge style and lets users pin connections in saved base plans', () => {
    render(<ProductionPlanSection baseId="base" sectionId="plan" />);
    expect(diagramProps.edgeTypes?.production).toBe(ProductionFlowEdge);
    expect(diagramProps.edges?.[0]).toMatchObject({
        type: 'production', source: 'node_0', target: 'node_1',
        style: { strokeWidth: 1.5, strokeOpacity: 0.4 },
        data: { itemName: 'Ore', rateLabel: '60.0/min' },
    });
    expect(diagramProps.nodesDraggable).toBe(false);
});

it('clears a pin when the production flow changes even if node IDs are reused', () => {
    const { rerender } = render(<EmbeddedFlowDiagram productionFlow={productionFlow} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin node to highlight connections' })[0]);
    rerender(<EmbeddedFlowDiagram productionFlow={{
        ...productionFlow,
        nodes: productionFlow.nodes.map(node => ({ ...node, outputAmount: 120 })),
    }} />);
    expect(screen.queryByRole('button', { name: 'Unpin node' })).not.toBeInTheDocument();
    expect(diagramProps.nodes?.[0].draggable).toBeUndefined();
    expect(diagramProps.edges?.[0].labelStyle?.outline).toBeUndefined();
});

it('omits pin controls when diagram interaction is disabled', () => {
    render(<EmbeddedFlowDiagram productionFlow={productionFlow} interactive={false} />);
    expect(screen.queryByRole('button', { name: 'Pin node to highlight connections' })).not.toBeInTheDocument();
    expect(diagramProps.nodesDraggable).toBe(false);
});
