import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemRecipe } from '@/features/buildings/recipe-utils';
import { NodeRecipeModal } from './NodeRecipeModal';
import { RecipeCard } from '@/features/buildings/ui/RecipeCard';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { NodeRecipeButton } from './NodeRecipeButton';
import type { FlowNode } from '@/features/planner/types';
import { generateReactFlowData } from './plannerFlowUtils';
import type { ReactNode } from 'react';

const dispatch = vi.hoisted(() => vi.fn());

vi.mock('@/app/uklad/bindings', () => ({
    useRuntime: () => ({ dispatch }),
    useSubscription: vi.fn(([id]: [string]) => id === appIds.subscriptions.ITEMS_RECIPES_BY_OUTPUT_ITEM_ID
        ? recipes
        : ({ plate: { id: 'plate', name: 'Plate', type: 'processed' } })),
}));
vi.mock('@/shared/ui', () => ({
    BuildingImage: () => null,
    ItemImage: () => null,
    RecipeTypeIcon: () => null,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const recipes: ItemRecipe[] = [
    { buildingId: 'smelter', recipeIndex: 0, recipeType: 'standard' as const },
    { buildingId: 'smelter-v2', recipeIndex: 0, recipeType: 'upgrade' as const },
    { buildingId: 'smelter', recipeIndex: 1, recipeType: 'alternative' as const },
].map(({ buildingId, recipeIndex, recipeType }) => ({
    building: { id: buildingId, name: buildingId, type: 'production' },
    recipe: { output: { id: 'plate', amount_per_minute: 60 }, inputs: [] },
    recipeIndex,
    recipeType,
}));

describe('NodeRecipeModal', () => {
    it('routes embedded graph selections to the owning plan', () => {
        const onSelectRecipe = vi.fn();
        const { nodes } = generateReactFlowData({
            flowNodes: [{
                nodeType: 'production', buildingId: 'smelter', buildingName: 'Smelter', recipeIndex: 0,
                outputItem: 'plate', outputAmount: 60, buildingCount: 1,
                powerPerBuilding: 0, heatPerBuilding: 0, totalPower: 0, totalHeat: 0,
            }],
            flowEdges: [],
            items: [{ id: 'plate', name: 'Plate', type: 'processed' }],
            onSelectRecipe,
        });
        render(<>{nodes[0].data.label as ReactNode}</>);
        fireEvent.click(screen.getByRole('button', { name: 'Recipes for Plate' }));
        fireEvent.click(screen.getByRole('button', { name: 'Select smelter Alternative recipe' }));
        expect(onSelectRecipe).toHaveBeenCalledExactlyOnceWith('plate', 'smelter:1');
        expect(dispatch).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('supports view-only recipe comparison', () => {
        render(<NodeRecipeModal
            item={{ id: 'plate', name: 'Plate', type: 'processed' }}
            node={{ buildingId: 'smelter', recipeIndex: 0 }}
            onClose={vi.fn()}
        />);
        expect(screen.getAllByRole('region')).toHaveLength(3);
        expect(screen.queryByRole('button', { name: /Select/ })).not.toBeInTheDocument();
    });

    it.each([undefined, 'plate-alternative'])('passes the recipe key to the selection callback (recipe ID: %s)', (id) => {
        recipes[2].recipe.id = id;
        const onClose = vi.fn();
        const onSelectRecipe = vi.fn();
        render(<NodeRecipeModal
            item={{ id: 'plate', name: 'Plate', type: 'processed' }}
            node={{ buildingId: 'smelter', recipeIndex: 0 }}
            onClose={onClose}
            onSelectRecipe={onSelectRecipe}
        />);

        expect(screen.getByRole('button', { name: 'Selected smelter Standard recipe' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Select smelter Alternative recipe' }));
        expect(onSelectRecipe).toHaveBeenCalledExactlyOnceWith('plate', `smelter:${id ?? 1}`);
        expect(dispatch).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
        delete recipes[2].recipe.id;
    });

    it.each(recipes)('highlights only the exact $recipeType recipe', (selected) => {
        render(<NodeRecipeModal
            item={{ id: 'plate', name: 'Plate', type: 'processed' }}
            node={{ buildingId: selected.building.id, recipeIndex: selected.recipeIndex }}
            onClose={vi.fn()}
        />);

        const sections = screen.getAllByRole('region');
        sections.forEach((section, index) => {
            expect(section.getAttribute('aria-current')).toBe(recipes[index] === selected ? 'true' : null);
        });
        expect(screen.getAllByText('Used in this node')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Planner' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Used in \(/)).not.toBeInTheDocument();
    });

    it('keeps the planner action on regular recipe cards', () => {
        render(<RecipeCard recipe={recipes[0].recipe} />);
        expect(screen.getByRole('button', { name: 'Planner' })).toBeInTheDocument();
    });

    it('does not subscribe until the recipe popup opens', () => {
        const node: FlowNode = {
            nodeType: 'production', buildingId: 'smelter', buildingName: 'Smelter', recipeIndex: 0,
            outputItem: 'plate', outputAmount: 60, buildingCount: 1,
            powerPerBuilding: 0, heatPerBuilding: 0, totalPower: 0, totalHeat: 0,
        };
        render(<NodeRecipeButton item={{ id: 'plate', name: 'Plate', type: 'processed' }} node={node} />);
        expect(useSubscription).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Recipes for Plate' }));
        expect(useSubscription).toHaveBeenCalledWith([appIds.subscriptions.ITEMS_RECIPES_BY_OUTPUT_ITEM_ID, 'plate']);
        fireEvent.click(screen.getByRole('button', { name: 'Close recipes' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps recipes inside a full-screen dialog and consumes Escape before closing the parent', () => {
        const node: FlowNode = {
            nodeType: 'production', buildingId: 'smelter', buildingName: 'Smelter', recipeIndex: 0,
            outputItem: 'plate', outputAmount: 60, buildingCount: 1,
            powerPerBuilding: 0, heatPerBuilding: 0, totalPower: 0, totalHeat: 0,
        };
        render(<dialog open aria-label="Plan diagram"><NodeRecipeButton item={{ id: 'plate', name: 'Plate', type: 'processed' }} node={node} /></dialog>);
        fireEvent.click(screen.getByRole('button', { name: 'Recipes for Plate' }));
        const parent = screen.getByRole('dialog', { name: 'Plan diagram' });
        expect(parent).toContainElement(screen.getByRole('dialog', { name: 'Recipes for Plate' }));
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        fireEvent(screen.getByRole('button', { name: 'Close recipes' }), escape);
        expect(escape.defaultPrevented).toBe(true);
        expect(screen.queryByRole('dialog', { name: 'Recipes for Plate' })).not.toBeInTheDocument();
        expect(parent).toHaveAttribute('open');
        expect(screen.getByRole('button', { name: 'Recipes for Plate' })).toHaveFocus();
    });
});
