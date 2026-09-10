import { useSyncExternalStore } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { PlannerViews } from './PlannerViews';

const planner = vi.hoisted(() => ({
    view: 'graph' as 'graph' | 'table',
    listeners: new Set<() => void>(),
    mode: 'single' as 'single' | 'multi',
    warning: null as string | null,
}));
vi.mock('@/app/uklad/bindings', () => ({
    useRuntime: () => ({ dispatch: ([, view]: [string, 'graph' | 'table']) => {
        planner.view = view;
        planner.listeners.forEach(listener => listener());
    } }),
    useSubscription: function useSubscription([id]: [string]) {
        const view = useSyncExternalStore(listener => { planner.listeners.add(listener); return () => { planner.listeners.delete(listener); }; }, () => planner.view);
        if (id === appIds.subscriptions.PLANNER_ACTIVE_VIEW) return view;
        if (id === appIds.subscriptions.PLANNER_MODE) return planner.mode;
        if (id === appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING) return planner.warning;
        throw new Error(`Unexpected subscription: ${id}`);
    },
}));

vi.mock('./PlannerFlowDiagram', () => ({
    PlannerFlowDiagram: () => <input aria-label="Graph viewport" defaultValue="initial" />,
}));
vi.mock('./PlannerProductionTable', () => ({
    PlannerProductionTable: () => <div data-testid="table-scroll"><input aria-label="Table state" defaultValue="initial" /></div>,
}));
afterEach(() => {
    cleanup();
    planner.view = 'graph';
    planner.mode = 'single';
    planner.warning = null;
});

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

it('pauses invalid multi-target views and resumes when repaired or switched to single mode', () => {
    planner.mode = 'multi';
    planner.warning = 'Iron Plate is required to produce Steel Plate.';
    const { rerender } = render(<PlannerViews />);
    expect(screen.queryByLabelText('Graph viewport')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Table state')).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Resolve the target warning to calculate production.');
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Resolve the target warning to calculate production.');

    planner.warning = null;
    rerender(<PlannerViews />);
    expect(screen.getByLabelText('Graph viewport')).toBeInTheDocument();
    expect(screen.getByLabelText('Table state')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Table' })).toHaveAttribute('aria-selected', 'true');

    planner.mode = 'single';
    planner.warning = 'The saved multi-target plan is still invalid.';
    rerender(<PlannerViews />);
    expect(screen.getByLabelText('Graph viewport')).toBeInTheDocument();
    expect(screen.getByLabelText('Table state')).toBeInTheDocument();
});
