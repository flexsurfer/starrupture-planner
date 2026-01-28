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
    PlannerItemSelector,
    PlannerTargetInput,
    PlannerFlowDiagram,
    PlannerCorporationLevelSelector,
    PlannerStatsDisplay,
} from './planner';

/**
 * Inner component for the production planner
 */
const PlannerPageInner: React.FC = () => {
    return (
        <div className="h-full flex flex-col bg-base-100">
            {/* Header Section */}
            <div className="p-1 bg-base-200 shadow-lg flex-shrink-0">
                {/* Mobile Layout - Compact */}
                <div className="flex flex-col gap-2 sm:hidden">
                    <div className="flex gap-2">
                        <PlannerItemSelector
                            className="select-sm text-xs"
                        />

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-base-content/70 whitespace-nowrap">Target/min:</span>
                            <PlannerTargetInput
                                className="input-sm text-xs"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        <PlannerStatsDisplay />
                        <PlannerCorporationLevelSelector />
                    </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex flex-row items-center gap-4 lg:gap-6">
                    <div className="form-control">
                        <PlannerItemSelector
                            className="select-sm"
                        />
                    </div>

                    <PlannerTargetInput
                        className="input-sm"
                    />

                    <div className="flex items-center">
                        <PlannerStatsDisplay />
                    </div>

                    <PlannerCorporationLevelSelector
                        className="max-w-md"
                    />

                </div>
            </div>

            {/* Flow Diagram Section */}
            <div className="flex-1 min-h-0">
                <PlannerFlowDiagram />
            </div>
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
