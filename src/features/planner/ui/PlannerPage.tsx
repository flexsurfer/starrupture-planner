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

import React from 'react';
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
    return (
        <div className="h-full flex flex-col bg-base-100">
            <PlannerTargetAlert />
            <PlannerViews renderHeader={() => (
                <div className="flex flex-col gap-2 p-2 sm:p-1 bg-base-200 shadow-lg shrink-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 sm:gap-x-4 lg:gap-x-6">
                        <div className={mode === 'single' ? 'flex w-full min-w-0 items-center gap-1.5 sm:contents' : 'contents'}>
                            {mode === 'multi' ? <PlannerMultiTargets /> : <div className="flex min-w-0 flex-1 sm:flex-none items-center gap-2 sm:gap-4">
                                <PlannerItemSelector className="select-sm w-0 min-w-0 flex-1 sm:w-50 sm:flex-none text-xs sm:text-sm" />
                                <div className="flex shrink-0 items-center gap-2">
                                    <PlannerTargetInput className="input-sm text-xs sm:text-sm" />
                                </div>
                            </div>}
                            <div className="shrink-0"><PlannerStatsDisplay /></div>
                        </div>
                        {mode === 'single' && <PlannerCorporationLevelSelector className="max-w-full sm:max-w-md" />}
                        <PlannerRecipeSelector />
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
