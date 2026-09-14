import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NodeCard } from './NodeCard';
import type { FlowNode } from '@/features/planner/types';

vi.mock('./NodeRecipeButton', () => ({ NodeRecipeButton: () => <button>Recipes</button> }));
vi.mock('@/shared/ui', () => ({
    ItemImage: () => <span>Item image</span>,
    BuildingImage: () => <span>Building image</span>,
    RecipeTypeIcon: () => null,
}));
afterEach(cleanup);

const node: FlowNode = {
    nodeType: 'production', buildingId: 'pressurizer', buildingName: 'Pressurizer',
    recipeIndex: 0, outputItem: 'helium', outputAmount: 30, buildingCount: 1.78,
    powerPerBuilding: 10, heatPerBuilding: 5, totalPower: 17.8, totalHeat: 8.9,
};

it('separates total item output from building details', () => {
    render(<NodeCard node={node} items={[{ id: 'helium', name: 'Pressurized Helium', type: 'processed' }]} outputColor="green" />);
    expect(screen.getByLabelText('Total output per minute')).toHaveTextContent('53.4/min');
    expect(screen.getByText('30.0/min')).toBeInTheDocument();
    expect(screen.getByTitle('2 buildings required')).toHaveTextContent('×2');
    expect(screen.getByTitle('2 buildings required')).toHaveClass('text-secondary');
    expect(screen.getByRole('button', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByText('Pressurized Helium').compareDocumentPosition(screen.getByText('Pressurizer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Building image')).toBeInTheDocument();
});

it('keeps the single-building count neutral', () => {
    render(<NodeCard node={{ ...node, buildingCount: 1 }} items={[]} outputColor="green" />);
    expect(screen.getByTitle('1 buildings required')).not.toHaveClass('text-secondary');
});

it.each([false, true])('renders an input requirement without a fake building or capacity meter (Advanced: %s)', (advanced) => {
    render(<NodeCard node={{ ...node, nodeType: 'input', outputAmount: 60, buildingCount: 1 }} items={[]} outputColor="green"
        inputRequirement={{ itemId: 'helium', required: 60, available: 0, missing: 60 }} showMissingInput={advanced} />);
    expect(screen.getByLabelText('Required input per minute')).toHaveTextContent('60.0/min needed');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByText('Building image')).not.toBeInTheDocument();
    expect(screen.getByText(advanced ? 'Input not configured' : 'Required resource')).toBeVisible();
});
