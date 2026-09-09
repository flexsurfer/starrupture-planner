import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

function TargetRate({ itemId, name, amount }: { itemId: string; name: string; amount: number }) {
    const runtime = useRuntime();
    const [draft, setDraft] = useState<string | null>(null);
    return <label className="flex items-center gap-1 text-sm">
        <input
            className="input input-sm input-bordered w-24"
            type="number" min="0.001" step="any"
            aria-label={`${name} target items per minute`}
            value={draft ?? amount}
            onChange={event => {
                const value = event.target.value;
                setDraft(value);
                const number = Number(value);
                if (Number.isFinite(number) && number > 0) {
                    runtime.dispatch([appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, itemId, number]);
                }
            }}
            onBlur={() => setDraft(null)}
        />
        /min
    </label>;
}

export function PlannerMultiTargets() {
    const runtime = useRuntime();
    const targets = useSubscription([appIds.subscriptions.PLANNER_MULTI_TARGETS]);
    const warning = useSubscription([appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING]);
    const items = useSubscription([appIds.subscriptions.PLANNER_SELECTABLE_ITEMS]);
    return <div className="order-6 flex w-full flex-wrap items-center gap-2">
        {warning && <div role="alert" className="alert alert-warning w-full text-sm">
            <div>
                <p>{warning}</p>
                <p>Production is paused. Change recipes or remove a target to continue.</p>
            </div>
        </div>}
        {targets.map(target => {
            const name = items.find(item => item.id === target.itemId)?.name ?? target.itemId;
            return <div key={target.itemId} className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-base-300 bg-base-100 p-2">
                <span className="text-sm">{name}</span>
                <TargetRate itemId={target.itemId} name={name} amount={target.amount} />
                <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove ${name} target`}
                    onClick={() => runtime.dispatch([appIds.events.PLANNER_REMOVE_TARGET, target.itemId])}>×</button>
            </div>;
        })}
        <select className="select select-sm select-bordered max-w-full" aria-label="Add production target" value=""
            onChange={event => {
                if (event.target.value) runtime.dispatch([appIds.events.PLANNER_ADD_TARGET, event.target.value]);
            }}>
            <option value="">Add target…</option>
            {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
    </div>;
}
