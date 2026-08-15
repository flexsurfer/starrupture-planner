import { appIds } from '@/app/uklad/catalog';
import { useCallback, useRef, useEffect } from 'react';
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
 * Custom hook for debounced target amount setting
 */
export const useTargetAmount = () => {
    const runtime = useRuntime();
    const targetAmount = useSubscription([appIds.subscriptions.PLANNER_TARGET_AMOUNT]);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setTargetAmount = useCallback((amount: number) => {
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout for the debounced planner update.
        timeoutRef.current = setTimeout(() => {
            runtime.dispatch([appIds.events.PLANNER_SET_TARGET_AMOUNT, amount]);
        }, 300); // 300ms debounce
    }, [runtime]);

    // Cleanup timeout on unmount
    useEffect(() => { return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); } }; }, []);

    return {
        targetAmount,
        setTargetAmount
    };
};
