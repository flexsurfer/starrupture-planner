import { useCallback } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { FlowNode } from '@/features/planner/types';
import { ExternalInputModal } from './ExternalInputModal';

export function usePlannerInputActions() {
    const runtime = useRuntime();
    const items = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const externalInputs = useSubscription([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS]);
    const renderInputDialog = useCallback((node: FlowNode, onClose: () => void) => <ExternalInputModal
        item={items[node.outputItem] ?? { id: node.outputItem, name: node.outputItem, type: 'unknown' }}
        initialAmount={(externalInputs[node.outputItem] ?? 0) + node.outputAmount * node.buildingCount} onClose={onClose}
        onConfirm={amount => {
            runtime.dispatch([appIds.events.PLANNER_SET_EXTERNAL_INPUT, node.outputItem, amount]);
            onClose();
        }} />, [runtime, items, externalInputs]);
    const onRevertInput = useCallback((node: FlowNode) => {
        runtime.dispatch([appIds.events.PLANNER_REMOVE_EXTERNAL_INPUT, node.outputItem]);
    }, [runtime]);
    return { renderInputDialog, onRevertInput };
}
