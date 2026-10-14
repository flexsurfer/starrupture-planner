import { useTranslation } from '@/shared/i18n';
import type { SavePowerNetwork } from '../overview';
import type { SaveCore } from '../snapshot';
import { SaveEnergyMeter } from './SaveEnergyMeter';

export function SaveCoreEnergy({ networks, cores }: { networks: SavePowerNetwork[]; cores: SaveCore[] }) {
    const { t } = useTranslation();
    const orderedCores = [...cores].sort((a, b) => a.spawnTimeSeconds - b.spawnTimeSeconds || a.id - b.id);

    return <section aria-label={t('Energy')} className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-base-content/50">
            <h3 className="font-medium">{t('Energy')}</h3>
            {networks.length === 0 && <span>—</span>}
        </div>
        {networks.map(network => {
            const label = t('Power network {number}', { number: network.id });
            return <div key={network.id} role="group" aria-label={label}>
                <SaveEnergyMeter label={label} powerUse={network.powerUse} powerGeneration={network.powerGeneration} />
                {network.coreIds.length > 0 && <div className="mt-1 text-base-content/40">{t('Connected Cores: {names}', {
                    names: orderedCores.filter(core => network.coreIds.includes(core.id))
                        .map(core => core.name ?? t('Core {number}', { number: orderedCores.indexOf(core) + 1 })).join(', '),
                })}</div>}
            </div>;
        })}
    </section>;
}
