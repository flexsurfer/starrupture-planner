import type { Building, Item } from '@/app/uklad/model';
import { useTranslation } from '@/shared/i18n';
import { BuildingImage, ItemImage } from '@/shared/ui';
import { connectionBuildingLabel } from '../utils/connectionLabels';

export interface ConnectionCardData {
    name: string;
    building?: Building;
    item?: Item;
    ratePerMinute?: number;
    baseName: string;
    planName?: string;
}

export function ConnectionCard({ name, building, item, ratePerMinute, baseName, planName, label, highlighted = false }: ConnectionCardData & { label: string; highlighted?: boolean }) {
    const { t } = useTranslation();
    return <article aria-label={label} title={label} aria-current={highlighted || undefined}
        className={`flex min-w-0 flex-col justify-center gap-2 self-stretch rounded-lg border bg-base-300 px-3 py-2.5 shadow-inner shadow-black/10 ${highlighted ? 'border-warning/60 bg-linear-to-br from-warning/10 to-warning/5' : 'border-base-content/10'}`}>
        <span aria-label={t('Base')} className="badge badge-sm h-auto min-h-5 max-w-full self-start whitespace-normal break-words border-base-content/15 bg-base-200 px-2 py-0.5 text-[10px] leading-snug text-base-content/70">
            {baseName || t('Missing base')}
        </span>
        <div className="flex min-w-0 flex-col items-start gap-1.5 @sm:flex-row @sm:gap-2">
            {item && <span className="shrink-0"><ItemImage itemId={item.id} item={item} size="xsmall" /></span>}
            <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium leading-snug">{item?.name || t('No material configured')}</p>
                {ratePerMinute !== undefined && <p className="mt-0.5 text-xs tabular-nums text-base-content/65">
                    {t('{value}/min', { value: Math.round(ratePerMinute * 10) / 10 })}
                </p>}
            </div>
        </div>
        <div className="flex min-w-0 items-start gap-1.5 text-xs text-base-content/70">
            {building && <BuildingImage buildingId={building.id} building={building} size="xsmall" className="shrink-0" />}
            <span className="min-w-0 break-words leading-snug">{building ? connectionBuildingLabel({ building, name, baseName }) : name}</span>
        </div>
        {planName && <div aria-label={t('Plan')} className="flex min-w-0 items-start gap-1.5 border-t border-base-content/10 pt-2 text-[11px] leading-snug">
            <span className="shrink-0 text-base-content/45">{t('Plan')}</span>
            <span className="min-w-0 break-words text-base-content/75">{planName}</span>
        </div>}
    </article>;
}
