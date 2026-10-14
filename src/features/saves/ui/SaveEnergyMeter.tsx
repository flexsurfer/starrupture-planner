import { useTranslation } from '@/shared/i18n';
import type { SavePowerNetwork } from '../overview';

export function SaveEnergyMeter({ label, powerUse, powerGeneration }: Pick<SavePowerNetwork, 'powerUse' | 'powerGeneration'> & { label: string }) {
    const { t, formatNumber } = useTranslation();
    const format = (value: number | null) => value === null ? '—' : formatNumber(value, { maximumFractionDigits: 1 });
    const known = powerUse !== null && powerGeneration !== null;
    const insufficient = known && powerUse > powerGeneration;
    const percentage = !known ? null : powerGeneration > 0
        ? Math.min(100, powerUse / powerGeneration * 100) : powerUse > 0 ? 100 : 0;
    const values = `${t('Power consumption')}: ${format(powerUse)} MW · ${t('Power generation')}: ${format(powerGeneration)} MW`;

    return <div className="text-[11px]">
        <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 ${insufficient ? 'text-error' : 'text-base-content/50'}`}>
            <span>{label}{insufficient && <span>{t(' · Insufficient')}</span>}</span>
            <span className="font-mono tabular-nums" title={t('Energy used / produced (MW)')}>
                {format(powerUse)} / {format(powerGeneration)} MW
            </span>
        </div>
        {percentage === null ? <div aria-hidden="true" className="mt-1 h-1 rounded-full bg-base-content/10" />
            : <div role="meter" aria-label={t('Energy Load')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}
                aria-valuetext={values} title={values} className="mt-1 h-1 overflow-hidden rounded-full bg-base-content/10">
                <div className={`h-full rounded-full ${insufficient ? 'bg-error' : 'bg-success'}`} style={{ width: `${percentage}%` }} />
            </div>}
    </div>;
}
