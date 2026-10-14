import { useTranslation } from '@/shared/i18n';

export function SaveCoreHeat({ heat, capacity }: { heat: number | null; capacity: number | null }) {
    const { t, formatNumber } = useTranslation();
    const format = (value: number | null) => value === null ? '—' : formatNumber(value, { maximumFractionDigits: 1 });
    const known = heat !== null && capacity !== null;
    const overCapacity = known && heat > capacity;
    const percentage = !known ? null : capacity > 0 ? Math.min(100, heat / capacity * 100) : heat > 0 ? 100 : 0;
    return <div className="text-[11px]">
        <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${overCapacity ? 'text-error' : 'text-base-content/50'}`}>
            <span title={t('Heat{value}', { value: overCapacity ? t(' · Over capacity') : '' })}>
                {t('Heat{value}', { value: overCapacity ? t(' · Over capacity') : '' })}
            </span>
            <span className="font-mono tabular-nums">{format(heat)} / {format(capacity)}</span>
        </div>
        {percentage === null ? <div aria-hidden="true" className="mt-1 h-1 rounded-full bg-base-content/10" />
            : <div role="meter" aria-label={t('Heat')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}
                aria-valuetext={`${format(heat)} / ${format(capacity)}`} className="mt-1 h-1 overflow-hidden rounded-full bg-base-content/10">
                <div className={`h-full rounded-full ${overCapacity ? 'bg-error' : 'bg-sky-400'}`} style={{ width: `${percentage}%` }} />
            </div>}
    </div>;
}
