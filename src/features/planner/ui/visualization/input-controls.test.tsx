import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { FlowNode } from '@/features/planner/types';
import { ExternalInputModal } from './ExternalInputModal';
import { NodeCard } from './NodeCard';

const item = { id: 'plate', name: 'Plate', type: 'processed' };
const storage = { id: 'storage_depot_v1', name: 'Storage v1', type: 'storage' };
const node: FlowNode = {
    nodeType: 'production', buildingId: 'smelter', buildingName: 'Smelter', recipeIndex: 0,
    outputItem: item.id, outputAmount: 60, buildingCount: 1,
    powerPerBuilding: 5, heatPerBuilding: 0, totalPower: 5, totalHeat: 0,
};
vi.mock('./NodeRecipeButton', () => ({ NodeRecipeButton: () => null }));
vi.mock('@/shared/ui', () => ({ ItemImage: () => null, BuildingImage: () => null, RecipeTypeIcon: () => null }));
vi.mock('@/app/uklad/bindings', () => ({
    useSubscription: ([id]: [string]) => {
        switch (id) {
            case appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION: return [storage];
            case appIds.subscriptions.ITEMS_BY_ID_MAP: return { plate: item };
            case appIds.subscriptions.BUILDINGS_BY_ID_MAP: return { [storage.id]: storage };
            case appIds.subscriptions.BASES_LIST: return [];
            default: return null;
        }
    },
}));
afterEach(cleanup);

it('opens an amount dialog outside the card and prevents invalid amounts', () => {
    const confirm = vi.fn();
    render(<NodeCard node={node} items={[item]} outputColor="green" renderInputDialog={(_, close) =>
        <ExternalInputModal item={item} initialAmount={60} onClose={close} onConfirm={amount => { confirm(amount); close(); }} />} />);
    const add = screen.getByRole('button', { name: 'Use external resource for Plate' });
    expect(add).toHaveClass('nodrag', 'nopan');
    fireEvent.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Use external resource' });
    expect(within(dialog).getByText('Plate')).toBeVisible();
    const amount = within(dialog).getByLabelText('Available amount / min');
    expect(amount).toHaveFocus();
    fireEvent.change(amount, { target: { value: '0' } });
    expect(within(dialog).getByRole('button', { name: 'Add input' })).toBeDisabled();
    fireEvent.change(amount, { target: { value: '75.5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add input' }));
    expect(confirm).toHaveBeenCalledWith(75.5);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps its popup inside a full-screen dialog and restores focus on Escape', () => {
    render(<dialog open aria-label="Full screen"><NodeCard node={node} items={[item]} outputColor="green"
        renderInputDialog={(_, close) => <ExternalInputModal item={item} initialAmount={60} onClose={close} onConfirm={vi.fn()} />} /></dialog>);
    const button = screen.getByRole('button', { name: 'Use external resource for Plate' });
    fireEvent.click(button);
    expect(within(screen.getByRole('dialog', { name: 'Full screen' })).getByRole('dialog', { name: 'Use external resource' })).toBeVisible();
    fireEvent.keyDown(screen.getByLabelText('Available amount / min'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Use external resource' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
});

it('labels external resources and requires confirmation before reverting', () => {
    const revert = vi.fn();
    const input = { ...node, nodeType: 'input' as const, baseBuildingId: 'input', buildingId: 'external-resource' };
    render(<NodeCard node={input} items={[item]} outputColor="green" onRevertInput={revert} />);
    expect(screen.getByText('External resource')).toBeVisible();
    expect(screen.queryByText('input', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByTitle('1 buildings required')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revert Plate to production' }));
    expect(revert).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: 'Remove external input?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(revert).not.toHaveBeenCalled();
    const trigger = screen.getByRole('button', { name: 'Revert Plate to production' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(revert).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Remove input' }));
    expect(revert).toHaveBeenCalledExactlyOnceWith(input);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

