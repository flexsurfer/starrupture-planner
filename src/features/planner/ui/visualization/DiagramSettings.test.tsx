import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { DiagramSettings } from './DiagramSettings';

const dispatch = vi.hoisted(() => vi.fn());
vi.mock('@/app/uklad/bindings', () => ({
    useRuntime: () => ({ dispatch }),
    useSubscription: ([id]: [string]) => id === appIds.subscriptions.PLANNER_FLOW_DIRECTION ? 'LR' : true,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('toggles the settings panel and dispatches diagram options', () => {
    render(<DiagramSettings />);
    const button = screen.getByRole('button', { name: 'Diagram settings' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Diagram direction')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('Diagram direction'), { target: { value: 'BT' } });
    expect(dispatch).toHaveBeenLastCalledWith([appIds.events.PLANNER_SET_FLOW_DIRECTION, 'BT']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Group by production stage' }));
    expect(dispatch).toHaveBeenLastCalledWith([appIds.events.PLANNER_SET_GROUP_BY_STAGE, false]);
    fireEvent.click(button);
    expect(screen.queryByRole('group', { name: 'Diagram options' })).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByLabelText('Diagram direction'), { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
});
