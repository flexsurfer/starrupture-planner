import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ReactFlowProps } from '@xyflow/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
            case appIds.subscriptions.ITEMS_BY_ID_MAP: return Object.fromEntries(items.map(item => [item.id, item]));
            case appIds.subscriptions.BASES_LIST: return [];
            case appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID: return productionFlow;
            case appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID: return {
                selectedBaseId: 'base',
                section: { id: 'plan', name: 'Plate plan', selectedItemId: 'plate', targetAmount: 60, active: false },
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

beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('uses the new edge style and lets users pin connections in saved base plans', () => {
    render(<ProductionPlanSection baseId="base" sectionId="plan" />);
    expect(diagramProps.edgeTypes?.production).toBe(ProductionFlowEdge);
    expect(diagramProps.edges?.[0]).toMatchObject({
        type: 'production', source: 'node_0', target: 'node_1',
        style: { strokeWidth: 1.5, strokeOpacity: 0.4 },
        data: { itemName: 'Ore', rateLabel: '60.0/min' },
    });
    expect(diagramProps.nodesDraggable).toBe(true);
    expect(diagramProps.nodes?.[1].style?.borderColor).toBe('var(--color-primary)');
    expect(diagramProps.nodes?.[0].style?.borderColor).not.toBe('var(--color-primary)');
    expect(diagramProps.panOnDrag).toBe(true);
    expect(diagramProps.zoomOnPinch).toBe(true);
    expect(diagramProps.zoomOnScroll).toBe(false);
    expect(diagramProps.preventScrolling).toBe(false);
    act(() => diagramProps.onNodesChange?.([{ id: 'node_1', type: 'position', position: { x: 250, y: 120 }, dragging: false }]));
    expect(diagramProps.nodes?.find(node => node.id === 'node_1')?.position).toEqual({ x: 250, y: 120 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin node to highlight connections' })[0]);
    expect(screen.getByRole('button', { name: 'Unpin node' })).toBeInTheDocument();
});

it('expands the diagram and returns to the inline view after closing or native dismissal', () => {
    render(<ProductionPlanSection baseId="base" sectionId="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Plate plan diagram' }));
    expect(screen.getByRole('dialog', { name: 'Plate plan' })).toBeVisible();
    expect(diagramProps.nodes?.[1].style?.borderColor).toBe('var(--color-primary)');
    expect(diagramProps.zoomOnScroll).toBe(true);
    expect(diagramProps.nodesDraggable).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close diagram' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(diagramProps.zoomOnScroll).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Plate plan diagram' }));
    fireEvent(screen.getByRole('dialog'), new Event('close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(diagramProps.zoomOnScroll).toBe(false);
});

it('keeps plan actions independent from diagram collapse', () => {
    render(<ProductionPlanSection baseId="base" sectionId="plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'Plate plan' }));
    expect(screen.queryByRole('region', { name: 'Plate plan diagram' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(dispatch).toHaveBeenCalledWith([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, 'base', 'plan']);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(dispatch).toHaveBeenCalledWith([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, 'plan']);
    expect(screen.getByRole('button', { name: 'Plate plan' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Plate plan' }));
    expect(screen.getByRole('region', { name: 'Plate plan diagram' })).toBeVisible();
});

it('lays out saved plans vertically on narrow screens', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<ProductionPlanSection baseId="base" sectionId="plan" />);
    expect(diagramProps.nodes?.[0].sourcePosition).toBe('bottom');
    expect(diagramProps.nodes?.[1].targetPosition).toBe('top');
    expect(diagramProps.nodes?.[1].position.y).toBeGreaterThan(diagramProps.nodes?.[0].position.y ?? 0);
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
