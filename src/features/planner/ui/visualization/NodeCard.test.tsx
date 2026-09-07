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
