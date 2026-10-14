import { useTranslation } from '@/shared/i18n';
import type { SavePowerNetwork } from '../overview';
import { SaveEnergyMeter } from './SaveEnergyMeter';

export function SavePowerNetworks({ networks, onOpenCore }: {
    networks: SavePowerNetwork[]; onOpenCore: (coreId: number) => void;
}) {
    const { t, formatNumber } = useTranslation();

    if (networks.length === 0) return <p className="py-10 text-center text-sm text-base-content/60">{t('No power networks found in this save.')}</p>;

    return <div className="space-y-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,23rem),1fr))] items-start gap-4">
            {networks.map(network => {
                const label = t('Power network {number}', { number: network.id });
                return <article key={network.id} aria-label={label} className="card min-w-0 border border-base-300 bg-base-200">
                    <div className="card-body gap-3 p-4">
                        <div>
                            <h2 className="text-sm font-medium text-base-content/80">{label}</h2>
                            <p className="mt-0.5 text-[11px] text-base-content/50">
                                {t('{count} Cores', { count: network.coreContributions.length })} · {t('{count} buildings', { count: network.buildingCount })}
                            </p>
                        </div>
                        <SaveEnergyMeter label={t('Energy')} powerUse={network.powerUse} powerGeneration={network.powerGeneration} />
                        <table className="w-full table-fixed text-xs">
                            <caption className="sr-only">{label}</caption>
                            <thead className="text-base-content/50">
                                <tr>
                                    <th scope="col" className="pb-1 text-left font-normal">{t('Core')}</th>
                                    <th scope="col" className="w-24 pb-1 text-right font-normal">{t('Buildings')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {network.coreContributions.map(core => {
                                    const name = core.name ?? t('Core {number}', { number: core.number });
                                    return <tr key={core.coreId} className="border-t border-base-content/5">
                                        <th scope="row" className="py-1 pr-2 text-left font-normal">
                                            <button type="button" className="link link-hover block max-w-full break-words py-1 text-base-content/80"
                                                aria-label={t('Open Core {name}', { name })} onClick={() => onOpenCore(core.coreId)}>{name}</button>
                                        </th>
                                        <td className="py-2 text-right font-mono tabular-nums text-base-content/70">{formatNumber(core.buildingCount)}</td>
                                    </tr>;
                                })}
                            </tbody>
                        </table>
                    </div>
                </article>;
            })}
        </div>
    </div>;
}
