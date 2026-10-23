import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { SaveMapIcon } from './SaveMapIcon';
import type { MapDisplaySettings } from './map-display';

import type { MapLayers } from '../map-preferences';

export function SaveMapSettings({ value, onChange, layers, onLayersChange }: {
    value: MapDisplaySettings; onChange: (value: MapDisplaySettings) => void;
    layers: MapLayers; onLayersChange: (layers: MapLayers) => void;
}) {
    const { t } = useTranslation();
    const id = useId();
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const container = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside, true);
        return () => document.removeEventListener('pointerdown', closeOutside, true);
    }, [open]);
    return <div ref={container} className="save-map-settings" onBlur={event => {
        // Label text can briefly focus the containing save tab before its checkbox receives focus.
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next) && !next.contains(event.currentTarget)) setOpen(false);
    }} onKeyDown={event => {
        if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
        }
    }}>
        <button ref={trigger} type="button" className="save-map-settings-trigger btn btn-sm btn-square border-base-300 bg-base-200 shadow"
            aria-label={t('Map settings')} title={t('Map settings')} aria-expanded={open}
            aria-controls={id} onClick={() => setOpen(!open)}>
            <SaveMapIcon name="settings" />
        </button>
        {open && <div id={id} className="save-map-settings-panel" role="group" aria-label={t('Map settings')}>
            <fieldset className="mb-3 border-b border-base-content/10 pb-2">
                <legend>{t('Map layers')}</legend>
                {([{ key: 'showLinks', label: 'Cargo links' }, { key: 'showBounds', label: 'Core bounds' }] as const).map(option =>
                    <label key={option.key} className="save-map-setting">
                        <span>{t(option.label)}</span>
                        <input type="checkbox" className="toggle toggle-sm" checked={layers[option.key]}
                            onChange={event => onLayersChange({ ...layers, [option.key]: event.target.checked })} />
                    </label>)}
            </fieldset>
            <fieldset>
                <legend>{t('Building size')}</legend>
                <div className="save-map-size-options">
                    {([{ size: 56, label: 'Compact' }, { size: 72, label: 'Standard' }, { size: 88, label: 'Large' }] as const).map(option =>
                        <button key={option.size} type="button" aria-pressed={value.buildingSize === option.size}
                            onClick={() => onChange({ ...value, buildingSize: option.size })}>{t(option.label)}</button>)}
                </div>
            </fieldset>
            <div className="save-map-settings-toggles">
                {([{ key: 'showNames', label: 'Building names' }, { key: 'showResources', label: 'Resource icons' },
                    { key: 'showGrid', label: 'Grid' }, { key: 'animateCargo', label: 'Cargo movement' }] as const).map(option =>
                    <label key={option.key} className="save-map-setting">
                        <span>{t(option.label)}</span>
                        <input type="checkbox" className="toggle toggle-sm" checked={value[option.key]}
                            onChange={event => onChange({ ...value, [option.key]: event.target.checked })} />
                    </label>)}
            </div>
        </div>}
    </div>;
}
