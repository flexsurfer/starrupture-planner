import { useTranslation } from '@/shared/i18n';
import { BuildingImage, ItemImage } from '@/shared/ui';
import type { SaveMapEntity } from '../map';
import { SaveCoreHeat } from './SaveCoreHeat';
import { SaveCoreResources } from './SaveCoreResources';
import { SaveMapIcon } from './SaveMapIcon';

export function SaveMapDetails({ entity, coreName, connected, onClose, onSelect, onFocusCore, onOpenCore }: {
    entity: SaveMapEntity; coreName: string; connected?: SaveMapEntity;
    onClose?: () => void; onSelect: (id: number) => void; onOpenCore: (id: number) => void; onFocusCore: (id: number) => void;
}) {
    const { t, formatNumber } = useTranslation();
    const detail = entity.detail;
    const name = detail ? detail.instance.name ?? detail.building.name : coreName;
    const connectedName = connected?.detail ? connected.detail.instance.name ?? connected.detail.building.name : null;
    const connectedCore = connected ? connected.core.core.name ?? t('Core {number}', { number: connected.coreNumber }) : null;
    const format = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });

    return <section className="save-map-details" aria-label={t('Building details')}>
        <div className="save-map-entity-heading">
            <BuildingImage buildingId={detail?.building.id ?? 'base_core'} building={{ name }} size="small" />
            <div>
                <h4>{name}</h4>
                {detail && name !== detail.building.name && <p>{detail.building.name}</p>}
                <p>{detail ? coreName : t('Lv.{level} · {count} buildings', {
                    level: entity.core.core.level === null ? '—' : entity.core.core.level + 1, count: entity.core.buildings.length,
                })}</p>
            </div>
            {onClose && <button type="button" className="save-map-icon-button" onClick={onClose} aria-label={t('Close')}><SaveMapIcon name="close" /></button>}
        </div>
        {detail ? <>
            {(detail.building.power !== undefined || detail.building.heat !== undefined) && <dl className="save-map-properties save-map-detail-section">
                {detail.building.power !== undefined && <div><dt>{t(detail.section === 'energy' ? 'Power generation' : 'Power consumption')}</dt>
                    <dd>{format(detail.building.power)} MW</dd></div>}
                {detail.building.heat !== undefined && <div><dt>{t('Heat')}</dt><dd>{format(detail.building.heat)}</dd></div>}
            </dl>}
            {detail.nodePurity && detail.nodePurity !== 'not-applicable' && <p className="save-map-detail-note">{t('Node purity: {purity}', {
                purity: t(({ impure: 'Impure', normal: 'Normal', pure: 'Pure' } as const)[detail.nodePurity]),
            })}</p>}
            {entity.inputs.length > 0 && <div className="save-map-detail-section">
                <h5>{t('Inputs')}</h5>
                <ul className="save-map-resource-list">{entity.inputs.map(input => <li key={input.itemId}>
                    <ItemImage itemId={input.itemId} item={{ name: input.name }} size="xsmall" />
                    <span>{input.name}</span><strong>{format(input.rate)}<small>{t('/min')}</small></strong>
                </li>)}</ul>
            </div>}
            {detail.resources.length > 0 && <div className="save-map-detail-section">
                <h5>{t('Max capacity')}</h5>
                <ul className="save-map-resource-list">{detail.resources.map(resource => <li key={`${resource.source}:${resource.itemId}`}>
                    <ItemImage itemId={resource.itemId} item={{ name: resource.name }} size="xsmall" />
                    <span>{resource.name}</span>
                    <strong title={resource.rate === null ? t('Rate unavailable') : undefined}>
                        {resource.rate === null ? '—' : <>{format(resource.rate)}<small>{t('/min')}</small></>}
                    </strong>
                </li>)}</ul>
            </div>}
            {detail.resources.length === 0 && ['extractor', 'dispatcher', 'receiver', 'launcher'].includes(detail.instance.configuration.kind)
                && <p className="save-map-detail-note">{t('Item unavailable')}</p>}
            {detail.instance.configuration.kind === 'production' && detail.instance.configuration.recipeId === null
                && <p className="save-map-detail-note">{t('Recipe unavailable')}</p>}
            {entity.connectedBuildingId !== null && <div className="save-map-detail-section">
                {connectedName && <><h5>{t('Cargo links')}</h5>
                    <p className="save-map-connected-name">{t(detail.instance.configuration.kind === 'receiver' ? 'From {name}' : 'To {name}', { name: connectedName })}</p>
                    <p className="save-map-detail-note">{connectedCore}</p></>}
                <button type="button" className="save-map-detail-action" onClick={() => onSelect(entity.connectedBuildingId!)}>
                    {t('Show connected building')}<SaveMapIcon name="arrow" />
                </button>
            </div>}
        </> : <>
            <div className="save-map-detail-section"><SaveCoreHeat heat={entity.core.heat} capacity={entity.core.heatCapacity} /></div>
            <div className="mt-3"><SaveCoreResources coreOverview={entity.core} /></div>
        </>}
        {!detail && <button type="button" className="save-map-detail-action save-map-open-core" onClick={() => onOpenCore(entity.core.core.id)}>
            <span>{t('View details')}</span><SaveMapIcon name="arrow" />
        </button>}
        {!detail && <button type="button" className="save-map-detail-action mt-2" onClick={() => onFocusCore(entity.id)}>
            <span>{t('Focus Core')}</span><SaveMapIcon name="focus" />
        </button>}
    </section>;
}
