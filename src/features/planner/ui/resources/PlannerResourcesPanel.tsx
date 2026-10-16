import { useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { ItemImage } from '@/shared/ui';
import { getItemCategoryColor } from '@/utils/itemColors';
import { CoreResourcePicker } from './CoreResourcePicker';
import { ManualResourceForm } from './ManualResourceForm';
import { ResourceFitPreview } from './ResourceFitPreview';
import { ResourceItemGroup } from './ResourceItemGroup';
import './PlannerResourcesPanel.css';

export interface PlannerResourcesPanelProps {
    onClose?: () => void;
    focusItemId?: string;
    initialAmount?: number;
    onClearNodeSelection?: () => void;
}

export function PlannerResourcesPanel(props: PlannerResourcesPanelProps) {
    const tabId = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB_ID]);
    return <PlannerResourcesPanelContent key={tabId} {...props} />;
}

function PlannerResourcesPanelContent({ onClose, focusItemId, initialAmount, onClearNodeSelection }: PlannerResourcesPanelProps) {
    const { t } = useTranslation();
    const groups = useSubscription([appIds.subscriptions.PLANNER_FILTERED_RESOURCE_SUMMARY, focusItemId ?? null]);
    const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const activeSave = useSubscription([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE]);
    const [showCores, setShowCores] = useState(false);
    const coresOpen = showCores && !!activeSave;
    return <div className="planner-resources-panel flex h-full min-h-0 min-w-0 flex-col bg-base-100" aria-label={t('Resources used by this plan')}>
        <div className="flex shrink-0 items-center gap-2 border-b border-base-300 px-4 py-3">
            {coresOpen && <button type="button" className="btn btn-ghost btn-sm btn-square"
                aria-label={t('Back to resources')} onClick={() => setShowCores(false)}>←</button>}
            <h2 className="min-w-0 flex-1 text-base font-semibold">{coresOpen ? t('Add from Factory Map') : t('Resources')}</h2>
            {onClose && <button type="button" data-dialog-autofocus className="btn btn-ghost btn-sm btn-square"
                aria-label={t('Close resources')} onClick={onClose}>×</button>}
        </div>
        {focusItemId && <div className="flex shrink-0 items-center gap-2 border-b border-base-300 bg-primary/5 px-4 py-3">
            <ItemImage itemId={focusItemId} size="small" />
            <div className="min-w-0 flex-1">
                <p className="text-xs text-base-content/60">{t('Selected node')}</p>
                <p className="break-words text-sm font-medium">{itemsById[focusItemId]?.name ?? focusItemId}</p>
            </div>
            {onClearNodeSelection && <button type="button" className="btn btn-ghost btn-sm btn-square shrink-0"
                aria-label={t('Clear node selection')} title={t('Clear node selection')} onClick={onClearNodeSelection}>×</button>}
        </div>}
        {coresOpen ? <CoreResourcePicker workspaceId={activeSave.id} focusItemId={focusItemId} onDone={() => setShowCores(false)} /> : <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-3">
                    <ManualResourceForm key={focusItemId ?? ''} focusItemId={focusItemId} initialAmount={initialAmount} />
                    {activeSave && <button type="button" className="btn btn-sm mt-2 h-auto min-h-8 w-full border-base-content/20 bg-base-200/30 py-1 text-xs font-medium text-base-content/70 shadow-none hover:border-base-content/40 hover:bg-base-200 hover:text-base-content"
                        onClick={() => setShowCores(true)}>{t('or add from Factory Map')}<span aria-hidden="true">→</span></button>}
                </div>
                {focusItemId && !groups.length && <p className="py-3 text-sm text-base-content/60">{t('No matching resources.')}</p>}
                <div className="divide-y divide-base-content/5">
                    {groups.map(group => <ResourceItemGroup key={group.itemId} group={group} focused={group.itemId === focusItemId}
                        color={getItemCategoryColor(itemsById[group.itemId]?.type)} />)}
                </div>
            </div>
            <ResourceFitPreview />
        </>}
    </div>;
}
