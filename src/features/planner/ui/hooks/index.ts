import { appIds } from '@/app/uklad/catalog';
import { useCallback } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';


/**
 * Custom hook for getting default output rate for an item
 */
export const usePlannerDefaultOutput = () => {
    const buildings = useSubscription([appIds.subscriptions.BUILDINGS_LIST]);

    // Helper function to find the default output rate for an item
    const getDefaultOutputRate = useCallback((itemId: string): number => {
        let bestRate: number | null = null;
        for (const building of buildings) {
            for (const recipe of building.recipes || []) {
                if (recipe.output.id === itemId) {
                    const rate = recipe.output.amount_per_minute;
                    if (bestRate === null || rate < bestRate) {
                        bestRate = rate;
                    }
                }
            }
        }
        if (bestRate !== null) return bestRate;
        return 60; // fallback if not found
    }, [buildings]);

    return getDefaultOutputRate;
};

/**
 * Commit edits immediately so switching or leaving a tab cannot discard them.
 */
export const useTargetAmount = () => {
    const runtime = useRuntime();
    const targetAmount = useSubscription([appIds.subscriptions.PLANNER_TARGET_AMOUNT]);
    const setTargetAmount = useCallback((amount: number) => {
        runtime.dispatch([appIds.events.PLANNER_SET_TARGET_AMOUNT, amount]);
    }, [runtime]);

    return {
        targetAmount,
        setTargetAmount
    };
};
