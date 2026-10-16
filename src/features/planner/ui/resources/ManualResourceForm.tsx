import { useId, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { isValidResourceRate } from '../../resources';

export function ManualResourceForm({ focusItemId, initialAmount = 60 }: { focusItemId?: string; initialAmount?: number }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const items = useSubscription([appIds.subscriptions.PLANNER_RESOURCE_ITEMS]);
    const [itemId, setItemId] = useState(focusItemId ?? '');
    const [amount, setAmount] = useState(String(Number(initialAmount.toFixed(4))));
    const formId = useId();
    const selectedItemId = items.some(item => item.id === itemId) ? itemId : '';
    const rate = Number(amount);
    const valid = !!selectedItemId && isValidResourceRate(rate);
    return <form className="flex items-end gap-2 rounded-lg bg-base-200 p-3" aria-label={t('Add manual resource')} onSubmit={event => {
        event.preventDefault();
        if (!valid) return;
        runtime.dispatch([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, selectedItemId, rate]);
    }}>
        <label className="min-w-0 flex-1 space-y-1" htmlFor={`${formId}-item`}>
            <span className="text-xs text-base-content/60">{t('Item')}</span>
            <select id={`${formId}-item`} className="select select-bordered select-sm w-full" value={selectedItemId}
                onChange={event => setItemId(event.target.value)} required disabled={!!focusItemId}>
                <option value="">{t('Choose an item')}</option>
                {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
        </label>
        <label className="w-24 shrink-0 space-y-1" htmlFor={`${formId}-amount`}>
            <span className="text-xs text-base-content/60">{t('Amount / min')}</span>
            <input id={`${formId}-amount`} type="number" min="0.0001" max="1000000000" step="any" required
                autoFocus={!!focusItemId} className="input input-bordered input-sm w-full tabular-nums" value={amount} onChange={event => setAmount(event.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm shrink-0" disabled={!valid}>{t('Add')}</button>
    </form>;
}
