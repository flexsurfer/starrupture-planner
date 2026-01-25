import { useCallback, useRef, useEffect } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { Building } from '../core/types';


/**
 * Custom hook for getting default output rate for an item
 */
export const usePlannerDefaultOutput = () => {
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);

    // Helper function to find the default output rate for an item
    const getDefaultOutputRate = useCallback((itemId: string): number => {
        for (const building of buildings) {
            for (const recipe of building.recipes) {
                if (recipe.output.id === itemId) {
                    return recipe.output.amount_per_minute;
                }
            }
        }
        return 60; // fallback if not found
    }, [buildings]);

    return getDefaultOutputRate;
};

/**
 * Custom hook for debounced target amount setting
 */
export const useTargetAmount = () => {
    const targetAmount = useSubscription<number>([SUB_IDS.TARGET_AMOUNT]);
    const timeoutRef = useRef<number | null>(null);

    const setTargetAmount = useCallback((amount: number) => {
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout for debounced dispatch
        timeoutRef.current = setTimeout(() => {
            dispatch([EVENT_IDS.SET_TARGET_AMOUNT, amount]);
        }, 300); // 300ms debounce
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => { return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); } }; }, []);

    return {
        targetAmount,
        setTargetAmount
    };
};
