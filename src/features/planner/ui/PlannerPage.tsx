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

import React, { useId, useState } from 'react';
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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsId = useId();
    return (
        <div className="h-full flex flex-col bg-base-100">
            <PlannerViews renderHeader={(viewControl) => (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-4 lg:gap-6 p-2 sm:p-1 bg-base-200 shadow-lg shrink-0">
                    <div className="flex w-full min-w-0 sm:w-auto sm:shrink-0 items-center gap-2 sm:gap-4">
                        <PlannerItemSelector className="select-sm min-w-0 flex-1 sm:w-50 sm:flex-none text-xs sm:text-sm" />
                        <div className="flex shrink-0 items-center gap-2">
                            <PlannerTargetInput className="input-sm text-xs sm:text-sm" />
                        </div>
                    </div>
                    <div className="order-2 shrink-0 sm:order-none">{viewControl}</div>
                    <div className="order-3 shrink-0 sm:order-none"><PlannerStatsDisplay /></div>
                    <button
                        type="button"
                        className={`order-4 ml-auto sm:hidden btn btn-sm gap-1 text-xs ${settingsOpen ? 'btn-active' : 'btn-ghost border border-base-300'}`}
                        aria-expanded={settingsOpen}
                        aria-controls={settingsId}
                        onClick={() => setSettingsOpen(open => !open)}
                    >
                        Settings <span aria-hidden="true">{settingsOpen ? '▴' : '▾'}</span>
                    </button>
                    <div
                        id={settingsId}
                        className={`order-5 w-full min-w-0 flex-wrap items-center gap-2 border-t border-base-300 pt-2 sm:contents ${settingsOpen ? 'flex' : 'hidden'}`}
                    >
                        <PlannerCorporationLevelSelector className="max-w-full sm:max-w-md" />
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
    return (
        <ReactFlowProvider>
            <PlannerPageInner />
        </ReactFlowProvider>
    );
};

export default PlannerPage;
