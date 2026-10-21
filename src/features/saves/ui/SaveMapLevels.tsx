import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from '@/shared/i18n';
import type { BuildingStack } from '../building-stacks';
import { SaveMapIcon } from './SaveMapIcon';

export function SaveMapLevels({ level, count, coreName, onChange }: {
    level: number; count: number; coreName: string; onChange: (level: number) => void;
}) {
    const { t, formatNumber } = useTranslation();
    const navigation = useRef<HTMLElement>(null);
    const activated = useRef<HTMLButtonElement | null>(null);
    useLayoutEffect(() => {
        const button = activated.current;
        if (button?.disabled) navigation.current?.querySelector<HTMLButtonElement>('button:enabled')?.focus({ preventScroll: true });
        activated.current = null;
    }, [level, count]);
    if (count < 2) return null;
    const label = t('Level {level} of {count}', { level, count });
    return <section className="save-map-levels" aria-label={t('Building levels')} ref={navigation}
        title={`${coreName} · ${label}. ${t('Shows this level and all levels below.')}`}>
        <div className="save-map-level-symbol" aria-hidden="true"><SaveMapIcon name="layers" /></div>
        <button type="button" aria-label={t('Higher level')} title={t('Higher level')} disabled={level === count}
            onClick={event => { activated.current = event.currentTarget; onChange(level + 1); }}><SaveMapIcon name="up" /></button>
        <output aria-label={label} aria-live="polite">{formatNumber(level)}</output>
        <button type="button" aria-label={t('Lower level')} title={t('Lower level')} disabled={level === 1}
            onClick={event => { activated.current = event.currentTarget; onChange(level - 1); }}><SaveMapIcon name="down" /></button>
    </section>;
}

export function SaveMapBuildingLayers({ stack, level, onSelect, onClose }: {
    stack: BuildingStack; level: number; onSelect: (id: number) => void; onClose: () => void;
}) {
    const { t } = useTranslation();
    const navigation = useRef<HTMLDivElement>(null);
    const activated = useRef<HTMLButtonElement | null>(null);
    useLayoutEffect(() => {
        const button = activated.current;
        if (!button) return;
        // Reaching the top/bottom disables the activated button. Keep keyboard
        // focus on the remaining direction instead of dropping it onto the page.
        (button.disabled ? navigation.current?.querySelector<HTMLButtonElement>('button:enabled') : button)?.focus({ preventScroll: true });
        activated.current = null;
    }, [level, stack]);
    return <section className="save-map-building-layers" aria-label={t('Building layers')}>
        <header className="save-map-building-layers-header">
            <SaveMapIcon name="layers" /><strong>{t('Building layers')}</strong><span>{t('Level {level}', { level })}</span>
            <button type="button" className="save-map-icon-button" onClick={onClose} aria-label={t('Close')}><SaveMapIcon name="close" /></button>
        </header>
        <div className="save-map-layer-navigation" ref={navigation}>
            <button type="button" disabled={!stack.below.length} onClick={event => { activated.current = event.currentTarget; onSelect(stack.below[0]); }}>
                <SaveMapIcon name="down" />{t('Below')}</button>
            <button type="button" disabled={!stack.above.length} onClick={event => { activated.current = event.currentTarget; onSelect(stack.above[0]); }}>
                {t('Above')}<SaveMapIcon name="up" /></button>
        </div>
    </section>;
}
