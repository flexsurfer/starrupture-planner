import { useCallback } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import type { FlowNode } from '@/features/planner/types';
import { PlanInputModal } from './PlanInputModal';

/** The editor selects newly added buildings automatically; saved diagrams address their plan directly. */
export function usePlanInputActions(baseId: string | null, planId?: string) {
    const runtime = useRuntime();
    const renderInputDialog = useCallback((node: FlowNode, onClose: () => void) => <PlanInputModal
        baseId={baseId} planId={planId}
        itemId={node.outputItem} amount={node.outputAmount * node.buildingCount}
        onClose={onClose} onAdd={request => {
            if (!baseId || !request.selectedItemId || !request.ratePerMinute) return;
            if (request.linkedOutput) {
                if (planId) runtime.dispatch([appIds.events.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, baseId, planId,
                    request.linkedOutput.baseId, request.linkedOutput.buildingId, request.buildingTypeId, request.name, request.description]);
                else runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
                    request.linkedOutput.baseId, request.linkedOutput.buildingId, request.buildingTypeId, request.name, request.description]);
            } else if (planId) {
                runtime.dispatch([appIds.events.PRODUCTION_PLAN_ADD_INPUT, baseId, planId,
                    request.selectedItemId, request.ratePerMinute, request.buildingTypeId, request.name, request.description]);
            } else {
                runtime.dispatch([appIds.events.BASES_ADD_BUILDINGS, baseId, request.buildingTypeId, 'inputs',
                    request.count, request.name, request.description, request.selectedItemId, request.ratePerMinute]);
            }
        }} />, [runtime, baseId, planId]);
    const onRevertInput = useCallback((node: FlowNode) => {
        if (!node.baseBuildingId || !baseId) return;
        if (planId) runtime.dispatch([appIds.events.PRODUCTION_PLAN_REMOVE_INPUT, baseId, planId, node.baseBuildingId]);
        else runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, node.baseBuildingId]);
    }, [runtime, baseId, planId]);
    return { renderInputDialog, onRevertInput };
}
