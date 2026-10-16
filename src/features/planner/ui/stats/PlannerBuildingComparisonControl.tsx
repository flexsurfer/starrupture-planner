import { useId, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import type { PlannerBuildingBaseline, PlannerResourcePicker } from '../../resources';

export function PlannerBuildingComparisonControl({ baseline }: { baseline: PlannerBuildingBaseline | null }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const activeSave = useSubscription([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE]);
    const picker = useSubscription([appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE, activeSave?.id ?? '']);
    const [editing, setEditing] = useState(false);
    const pickerId = useId();
    const pickerOpen = editing && !!picker;
    return <div className="mb-4 min-w-0 space-y-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-words text-xs text-base-content/60">
                {baseline ? t('Selected cores: {names}', { names: baseline.coreNames.join(', ') })
                    : t(picker
                        ? 'Select cores to compare their production buildings with this plan and see how many more you need to build.'
                        : 'Import a save in Factory Map to compare its production buildings with this plan and see how many more you need to build.')}
            </p>
            <div className="flex shrink-0 items-center gap-2">
                {(picker || !baseline) && <button type="button" className="btn btn-outline btn-sm" disabled={!picker} aria-expanded={pickerOpen} aria-controls={pickerId}
                    onClick={() => setEditing(value => !value)}>{t(baseline ? 'Change cores' : 'Compare buildings')}</button>}
                {baseline && <button type="button" className="btn btn-ghost btn-sm btn-square text-base-content/50" aria-label={t('Clear comparison')}
                    onClick={() => { runtime.dispatch([appIds.events.PLANNER_CLEAR_BUILDING_BASELINE]); setEditing(false); }}>×</button>}
            </div>
        </div>
        {pickerOpen && <div id={pickerId}>
            <ComparisonCores key={`${picker.workspaceId}:${picker.snapshotKey}`} picker={picker} onDone={() => setEditing(false)} />
        </div>}
    </div>;
}

function ComparisonCores({ picker, onDone }: { picker: PlannerResourcePicker; onDone: () => void }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const [selected, setSelected] = useState<number[]>([]);
    return <div className="space-y-3 rounded-md border border-base-300 bg-base-100 p-3" role="group" aria-label={t('Choose cores')}>
        {!picker.compatible && <p className="text-xs text-warning">{t('Building comparison is unavailable for this game version.')}</p>}
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {picker.cores.map(core => <label key={core.coreKey} className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${selected.includes(core.coreId) ? 'border-primary/60 bg-primary/10' : 'border-base-300'}`}>
                <input type="checkbox" className="checkbox checkbox-xs rounded-none border border-base-content/35 bg-none shadow-none before:shadow-none checked:shadow-none" aria-label={t('Select {core}', { core: core.name })}
                    disabled={!picker.compatible} checked={selected.includes(core.coreId)} onChange={event => {
                        const checked = event.target.checked;
                        setSelected(previous => checked ? [...previous, core.coreId] : previous.filter(id => id !== core.coreId));
                    }} /><span className="break-words">{core.name}</span>
            </label>)}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>{t('Cancel')}</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!picker.compatible || !selected.length} onClick={() => {
                runtime.dispatch([appIds.events.PLANNER_SET_BUILDING_BASELINE, picker.workspaceId, picker.snapshotKey, selected]);
                onDone();
            }}>{t('Use selected cores')}</button>
        </div>
    </div>;
}
