import { useTranslation } from '@/shared/i18n';
import type { SavePowerNetwork } from '../overview';
import type { SaveCore } from '../snapshot';

export function SaveCoreEnergy({ networks, cores }: { networks: SavePowerNetwork[]; cores: SaveCore[] }) {
    const { t, formatNumber } = useTranslation();
    const format = (value: number | null) => value === null ? '—' : formatNumber(value, { maximumFractionDigits: 1 });
    const orderedCores = [...cores].sort((a, b) => a.spawnTimeSeconds - b.spawnTimeSeconds || a.id - b.id);

    return <section aria-label={t('Energy')} className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-base-content/50">
            <h3 className="font-medium">{t('Energy')}</h3>
            {networks.length === 0 && <span>—</span>}
        </div>
        {networks.map(network => {
            const { powerUse, powerGeneration } = network;
            const known = powerUse !== null && powerGeneration !== null;
            const insufficient = known && powerUse > powerGeneration;
            const percentage = !known ? null : powerGeneration > 0
                ? Math.min(100, powerUse / powerGeneration * 100) : powerUse > 0 ? 100 : 0;
            const label = t('Power network {number}', { number: network.id });
            const values = `${t('Power consumption')}: ${format(powerUse)} MW · ${t('Power generation')}: ${format(powerGeneration)} MW`;
            return <div key={network.id} role="group" aria-label={label}>
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
                {network.coreIds.length > 0 && <div className="mt-1 text-base-content/40">{t('Connected Cores: {names}', {
                    names: orderedCores.filter(core => network.coreIds.includes(core.id))
                        .map(core => core.name ?? t('Core {number}', { number: orderedCores.indexOf(core) + 1 })).join(', '),
                })}</div>}
            </div>;
        })}
    </section>;
}
