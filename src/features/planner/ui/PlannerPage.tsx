import { PlannerResourcesButton } from './controls/PlannerResourcesButton';
import { PlannerResourcesDock } from './PlannerResourcesDock';
import { PlannerTabs, PlannerTabCreation } from './PlannerTabs';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { PlannerTargetAlert } from './controls/PlannerTargetAlert';
import { PlannerMultiTargets } from './controls/PlannerMultiTargets';
/**
 * Production Planner Page
 * 
 * This component provides the main UI for the production planner feature.
 * It orchestrates the item selection, target input, and flow diagram components.
 * 
 * Features:
 * - Item selection dropdown (excludes raw materials)
 * - Interactive flow diagram with zoom/pan controls
 * - Dark/light theme support
 * - Building count calculations and material flow rates
 */

import React, { useCallback, useId, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import {
    PlannerCorporationLevelSelector,
    PlannerItemSelector,
    PlannerRecipeSelector,
    PlannerTargetInput,
} from './controls';
import { PlannerStatsDisplay } from './stats';
import { PlannerViews } from './visualization/PlannerViews';

/**
 * Inner component for the production planner
 */
const PlannerPageInner: React.FC = () => {
    const mode = useSubscription([appIds.subscriptions.PLANNER_MODE]);
    const [resourceEditor, setResourceEditor] = useState<{ itemId?: string; amount?: number; requestId?: number } | null>(null);
    const panelId = useId();
    const openResource = useCallback((itemId: string, amount: number) => setResourceEditor(previous => ({
        itemId, amount, requestId: (previous?.requestId ?? 0) + 1,
    })), []);
    const closeResources = useCallback(() => setResourceEditor(null), []);
    const clearResourceSelection = useCallback(() => setResourceEditor(previous => previous
        ? { requestId: previous.requestId } : null), []);
    return (
        <div className="h-full flex flex-col bg-base-100">
            <PlannerTargetAlert />
            <PlannerViews onManageResource={openResource}
                sidebar={resourceEditor && <PlannerResourcesDock id={panelId} focusItemId={resourceEditor.itemId}
                    initialAmount={resourceEditor.amount} requestId={resourceEditor.requestId} onClose={closeResources}
                    onClearNodeSelection={clearResourceSelection} />}
                renderHeader={() => (
                <div className="flex flex-col gap-2 p-2 sm:p-1 bg-base-200 shadow-lg shrink-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 sm:gap-x-4 lg:gap-x-6">
                        {mode === 'multi' ? <PlannerMultiTargets /> : <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-4">
                            <PlannerItemSelector className="select-sm w-0 min-w-0 flex-1 sm:w-50 sm:flex-none text-xs sm:text-sm" />
                            <div className="flex shrink-0 items-center gap-2">
                                <PlannerTargetInput className="input-sm text-xs sm:text-sm" />
                            </div>
                        </div>}
                        <div className="flex max-w-full flex-wrap items-center gap-1.5">
                            <PlannerRecipeSelector />
                            <PlannerResourcesButton open={resourceEditor !== null} panelId={panelId} onClick={() => setResourceEditor(value => value ? null : {})} />
                            <PlannerStatsDisplay />
                            {mode === 'single' && <PlannerCorporationLevelSelector className="max-w-full sm:max-w-md" />}
                        </div>
                    </div>
                </div>

            )} />
        </div>
    );
};

/**
 * Main Production Planner component wrapper with ReactFlowProvider
 */
const PlannerPage: React.FC = () => {
    const activeTab = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB]);
    return <div className="flex h-full min-h-0 min-w-0 flex-col bg-base-100">
        {activeTab ? <>
            <PlannerTabs />
            <div id="planner-tab-panel" role="tabpanel" aria-labelledby={`planner-tab-${activeTab.id}`} className="min-h-0 flex-1">
                <ReactFlowProvider key={activeTab.id}>
                    <PlannerPageInner />
                </ReactFlowProvider>
            </div>
            <PlannerTabCreation />
        </> : <PlannerTabCreation empty />}
    </div>;
};

export default PlannerPage;
