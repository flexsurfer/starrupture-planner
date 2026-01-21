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

import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { EVENT_IDS } from '../state/event-ids';

import {
    PlannerItemSelector,
    PlannerTargetInput,
    PlannerFlowDiagram,
    CorporationLevelSelector,
    usePlannerDefaultOutput,
} from './planner';

/**
 * Inner component for the production planner
 */
const PlannerPageInner: React.FC = () => {
    const selectedItemId = useSubscription<string | null>([SUB_IDS.SELECTED_PLANNER_ITEM]);
    const getDefaultOutputRate = usePlannerDefaultOutput();

    // Local state for target amount
    const [targetAmount, setTargetAmount] = useState<number>(60);

    // Automatically calculate targetAmount when selectedItemId changes (e.g., from navigation)
    useEffect(() => {
        if (selectedItemId) {
            const defaultOutput = getDefaultOutputRate(selectedItemId);
            setTargetAmount(defaultOutput);
        }
    }, [selectedItemId, getDefaultOutputRate]);

    /**
     * Handles item selection from the dropdown
     */
    const handleItemSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const itemId = event.target.value;
        dispatch([EVENT_IDS.SET_PLANNER_ITEM, itemId || null]);
    }, [getDefaultOutputRate]);

    return (
        <div className="h-full flex flex-col bg-base-100">
            {/* Header Section */}
            <div className="p-2 lg:p-4 bg-base-200 shadow-lg flex-shrink-0">
                {/* Mobile Layout - Compact */}
                <div className="flex flex-col gap-2 sm:hidden">
                    <PlannerItemSelector
                        selectedItemId={selectedItemId || ''}
                        onItemSelect={handleItemSelect}
                        className="select-sm w-full text-xs"
                    />

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-base-content/70 whitespace-nowrap">Target/min:</span>
                        <PlannerTargetInput
                            targetAmount={targetAmount}
                            onTargetAmountChange={setTargetAmount}
                            className="input-sm w-20 text-xs"
                            showLabel={false}
                        />
                    </div>

                    <CorporationLevelSelector className="w-full" />
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex flex-row items-end gap-4 lg:gap-6">
                    <div className="form-control">
                        <PlannerItemSelector
                            selectedItemId={selectedItemId || ''}
                            onItemSelect={handleItemSelect}
                            className="select-sm lg:select-md"
                        />
                    </div>

                    <PlannerTargetInput
                        targetAmount={targetAmount}
                        onTargetAmountChange={setTargetAmount}
                        className="input-sm lg:input-md w-24 lg:w-28"
                    />

                    <CorporationLevelSelector className="max-w-md" />
                </div>
            </div>

            {/* Flow Diagram Section */}
            <div className="flex-1 min-h-0">
                <PlannerFlowDiagram
                    selectedItemId={selectedItemId || ''}
                    targetAmount={targetAmount}
                />
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