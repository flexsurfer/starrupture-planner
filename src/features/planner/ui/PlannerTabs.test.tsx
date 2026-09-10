import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider, useSubscription } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { ConfirmationDialog } from '@/features/app-shell/ui/ConfirmationDialog';
import { PlannerTabs, PlannerTabCreation } from './PlannerTabs';
import { PlannerTargetInput } from './controls/PlannerTargetInput';

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

function TabScreen() {
    const active = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB]);
    return <>
        {active && <PlannerTabs />}
        {active?.mode === 'single' && <PlannerTargetInput key={active.id} />}
        <PlannerTabCreation empty={!active} />
        <ConfirmationDialog />
    </>;
}

function setup() {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    render(<UkladProvider runtime={runtime}><TabScreen /></UkladProvider>);
    return harness;
}

it('requires a nonblank name, creates fixed-mode tabs, and supports + and keyboard switching', async () => {
    const harness = setup();
    expect(screen.getByRole('heading', { name: 'Create your first planner tab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create tab' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tab name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Create tab' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tab name'), { target: { value: '  Shared plan  ' } });
    fireEvent.click(screen.getByRole('radio', { name: /Multi-target/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create tab' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Shared plan' })).toHaveAttribute('aria-selected', 'true'));
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MODE])).toBe('multi');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create new planner tab' }));
    await screen.findByRole('dialog', { name: 'Create planner tab' });
    fireEvent.change(screen.getByLabelText('Tab name'), { target: { value: 'Single plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tab' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Single plan' })).toHaveAttribute('aria-selected', 'true'));
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MODE])).toBe('single');
    fireEvent.change(screen.getByLabelText('Target items per minute'), { target: { value: '125' } });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Single plan' }), { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Shared plan' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: 'Shared plan' })).toHaveFocus();
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_MODE])).toBe('multi');
    fireEvent.click(screen.getByRole('tab', { name: 'Single plan' }));
    await waitFor(() => expect(screen.getByLabelText('Target items per minute')).toHaveValue(125));
});

it('does not delete until confirmed, preserves an inactive tab on cancel, and shows creation after the last close', async () => {
    const harness = setup();
    await act(async () => {
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'one', 'One', 'single']);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'two', 'Two', 'multi']);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close One' }));
    await screen.findByText('Close “One”?');
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toHaveLength(2);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB_ID])).toBe('two');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Close “One”?')).not.toBeInTheDocument());
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close Two' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete tab' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Two' })).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close One' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete tab' }));
    await screen.findByRole('heading', { name: 'Create your first planner tab' });
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TABS])).toEqual([]);
});
