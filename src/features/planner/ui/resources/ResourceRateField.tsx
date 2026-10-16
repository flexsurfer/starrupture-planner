import { useId, useState } from 'react';
import { isValidResourceRate } from '../../resources';

/** Keep incomplete numeric drafts local; publish only a complete positive rate. */
export function ResourceRateField({ value, label, onChange, disabled = false }: {
    value: number;
    label: string;
    onChange: (value: number) => void;
    disabled?: boolean;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const id = useId();
    const commit = () => {
        if (draft === null) return;
        const amount = Number(draft);
        if (isValidResourceRate(amount) && amount !== value) onChange(amount);
        setDraft(null);
    };
    return <input id={id} aria-label={label} type="number" min="0.0001" max="1000000000" step="any"
        className="input input-bordered input-sm w-22 shrink-0 px-2 text-right tabular-nums" disabled={disabled}
        value={draft ?? value} onChange={event => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape' && draft !== null) { event.preventDefault(); event.stopPropagation(); setDraft(null); }
        }} />;
}
