import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlannerViews } from './PlannerViews';

vi.mock('./PlannerFlowDiagram', () => ({
    PlannerFlowDiagram: () => <input aria-label="Graph viewport" defaultValue="initial" />,
}));
vi.mock('./PlannerProductionTable', () => ({
    PlannerProductionTable: () => <div data-testid="table-scroll"><input aria-label="Table state" defaultValue="initial" /></div>,
}));
afterEach(cleanup);

it('keeps both views and their state when switching tabs', () => {
    render(<PlannerViews />);
    const graph = screen.getByLabelText('Graph viewport');
    const table = screen.getByLabelText('Table state');
    const scroll = screen.getByTestId('table-scroll');
    fireEvent.change(graph, { target: { value: 'zoomed and panned' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    fireEvent.change(table, { target: { value: 'table state' } });
    scroll.scrollTop = 300;
    expect(graph.closest('[role="tabpanel"]')).toHaveAttribute('inert');
    expect(graph.closest('[role="tabpanel"]')).toHaveClass('opacity-0');
    expect(table.closest('[role="tabpanel"]')).toHaveClass('bg-base-100', 'z-10');
    fireEvent.click(screen.getByRole('tab', { name: 'Graph' }));
    expect(screen.getByLabelText('Graph viewport')).toBe(graph);
    expect(graph).toHaveValue('zoomed and panned');
    expect(table.closest('[role="tabpanel"]')).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByLabelText('Table state')).toBe(table);
    expect(table).toHaveValue('table state');
    expect(scroll.scrollTop).toBe(300);
});

it('supports keyboard navigation between views', () => {
    render(<PlannerViews />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Graph' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Table' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Table' })).toHaveFocus();
});
