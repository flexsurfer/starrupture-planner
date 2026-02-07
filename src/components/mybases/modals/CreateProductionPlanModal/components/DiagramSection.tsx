import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import type { ProductionFlowResult } from '../../../../planner/core/types';
import { EmbeddedFlowDiagram } from '../../../components/EmbeddedFlowDiagram';

export const DiagramSection: React.FC = () => {

    const productionFlow = useSubscription<ProductionFlowResult>([SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW])
        || { nodes: [], edges: [], rawMaterialDeficits: [] };

    if (productionFlow.nodes.length === 0) {
        return (
            <div className="flex-1 overflow-hidden relative min-h-0">
                <div className="flex items-center justify-center h-full text-base-content/50">
                    <div className="text-center">
                        <div className="text-4xl mb-2">📐</div>
                        <p>Select an item to preview the production flow</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-hidden relative min-h-0">
            <EmbeddedFlowDiagram
                productionFlow={productionFlow}
                className="w-full h-full"
            />
        </div>
    );
};
