import { useCallback } from 'react';
import type { FlowNode } from '@/features/planner/types';

/** Graph and table shortcuts share the plan's resource editor. */
export function usePlannerInputActions(onManageResource?: (itemId: string, amount: number) => void) {
    const manage = useCallback((node: FlowNode) => onManageResource?.(node.outputItem, node.outputAmount * node.buildingCount), [onManageResource]);
    return { onManageResources: onManageResource ? manage : undefined };
}
