import { useId, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

export function DiagramSettings() {
    const runtime = useRuntime();
    const direction = useSubscription([appIds.subscriptions.PLANNER_FLOW_DIRECTION]);
    const groupByStage = useSubscription([appIds.subscriptions.PLANNER_GROUP_BY_STAGE]);
    const [open, setOpen] = useState(false);
    const panelId = useId();

    return <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-2"
        onKeyDown={event => {
            if (event.key === 'Escape') {
                setOpen(false);
                event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();
            }
        }}>
        <button type="button" className="btn btn-sm btn-square border-base-300 bg-base-200 shadow"
            aria-label="Diagram settings" title="Diagram settings" aria-expanded={open} aria-controls={panelId}
            onClick={() => setOpen(value => !value)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
                <circle cx="9" cy="6" r="2" fill="currentColor" />
                <circle cx="15" cy="12" r="2" fill="currentColor" />
                <circle cx="9" cy="18" r="2" fill="currentColor" />
            </svg>
        </button>
        {open && <div id={panelId} role="group" aria-label="Diagram options"
            className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-200 p-3 text-sm shadow-lg">
            <label className="flex items-center justify-between gap-4">
                Direction
                <select className="select select-sm select-bordered w-auto" aria-label="Diagram direction"
                    value={direction}
                    onChange={event => {
                        const value = event.target.value;
                        if (value === 'LR' || value === 'RL' || value === 'TB' || value === 'BT') {
                            runtime.dispatch([appIds.events.PLANNER_SET_FLOW_DIRECTION, value]);
                        }
                    }}>
                    <option value="LR">Left → right</option>
                    <option value="RL">Right → left</option>
                    <option value="TB">Top → bottom</option>
                    <option value="BT">Bottom → top</option>
                </select>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
                Group by production stage
                <input type="checkbox" className="toggle toggle-sm" checked={groupByStage}
                    onChange={event => runtime.dispatch([appIds.events.PLANNER_SET_GROUP_BY_STAGE, event.target.checked])} />
            </label>
        </div>}
    </div>;
}
