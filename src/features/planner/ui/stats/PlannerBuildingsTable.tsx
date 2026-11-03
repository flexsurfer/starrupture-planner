import { useTranslation } from '@/shared/i18n';
import { BuildingImage } from '@/shared/ui/BuildingImage';
import type { PlannerStatsBuildingRow } from '../../types';

export function PlannerBuildingsTable({ rows, comparisonScope, compact = false }: {
    rows: PlannerStatsBuildingRow[]; comparisonScope?: 'cores' | 'network'; compact?: boolean;
}) {
    const { t, formatNumber } = useTranslation();
    return <>
        <div className={compact ? 'overflow-x-auto' : 'max-h-[60vh] overflow-auto rounded-lg border border-base-300 bg-base-100 shadow-sm'}>
            <table aria-label={t('Buildings')} className={`table w-full ${compact ? 'table-xs wrap-normal [&_tr]:border-0 [&_tbody_tr]:text-xs' : 'table-zebra'}`}>
                <thead className={`sticky top-0 z-10 bg-base-200 ${compact ? 'whitespace-normal text-xs text-base-content/60 [&_th]:font-normal' : ''}`}>
                    <tr>
                        <th scope="col" className={compact ? 'w-[40%]' : undefined}>{t('Building')}</th>
                        <th scope="col" className="text-right">{t(comparisonScope ? 'Plan needs' : 'Count')}</th>
                        {comparisonScope && <>
                            <th scope="col" className="text-right">{t(comparisonScope === 'network' ? 'On this network' : 'In cores')}</th>
                            <th scope="col" className="text-right">{t('To build')}</th>
                        </>}
                        {!compact && <>
                            <th scope="col" className="text-right">{t('Power')}</th>
                            <th scope="col" className="text-right">{t('Heat')}</th>
                        </>}
                    </tr>
                </thead>
                <tbody>{rows.map(building => <tr key={building.buildingId}>
                    <td>
                        <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="shrink-0">
                                <BuildingImage buildingId={building.buildingId} size={compact ? 'xsmall' : 'small'} className={compact ? '' : 'size-8'} />
                            </span>
                            <span className="font-medium">{building.buildingName}</span>
                        </div>
                    </td>
                    <td className="text-right font-semibold tabular-nums">{formatNumber(building.count)}</td>
                    {comparisonScope && <>
                        <td className="text-right tabular-nums">{building.comparison ? formatNumber(building.comparison.existing) : '—'}</td>
                        <td className={`text-right tabular-nums ${building.comparison && building.comparison.additional > 0 ? 'font-semibold text-[color-mix(in_oklab,var(--color-warning)_50%,var(--color-base-content))]' : 'text-base-content/65'}`}>
                            {building.comparison ? formatNumber(building.comparison.additional) : '—'}
                        </td>
                    </>}
                    {!compact && <>
                        <td className="text-right">⚡ {building.totalPower.toFixed(0)}</td>
                        <td className="text-right">🔥 {building.totalHeat.toFixed(0)}</td>
                    </>}
                </tr>)}</tbody>
            </table>
        </div>
        {comparisonScope && <p className="mt-2 text-xs text-base-content/60">{t('Only production buildings are compared, including those already in use.')}</p>}
    </>;
}
