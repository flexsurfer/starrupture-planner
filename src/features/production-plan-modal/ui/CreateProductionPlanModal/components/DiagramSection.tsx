import { appIds } from '@/app/uklad/catalog';
import React, { useCallback } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { EmbeddedFlowDiagram } from '@/features/production-plans/ui';

export const DiagramSection: React.FC = () => {
    const runtime = useRuntime();
    const onSelectRecipe = useCallback((itemId: string, recipeKey: string) => {
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, itemId, recipeKey]);
    }, [runtime]);

    const productionFlow = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW])
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
                onSelectRecipe={onSelectRecipe}
                className="w-full h-full"
            />
        </div>
    );
};
