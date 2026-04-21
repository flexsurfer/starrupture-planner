import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import type { RawMaterialDeficitWithName } from '../../../../planner/core/types';

export const DeficitsAlert: React.FC = () => {
    const deficits = useSubscription<RawMaterialDeficitWithName[]>([SUB_IDS.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS]);

    if (deficits.length === 0) {
        return null;
    }

    return (
        <div className="px-4 py-2 flex-shrink-0">
            <div className="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3">
                <div className="flex gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 text-base-content/50 mt-0.5" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-base-content/85">Missing Materials</span>
                    <span className="text-xs text-base-content/65">
                        This does not block saving the plan. You can cover these materials later.
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {deficits.map(deficit => (
                            <span key={deficit.itemId} className="badge badge-sm badge-outline gap-1 text-base-content/75">
                                {deficit.itemName}: -{deficit.missing.toFixed(1)}/min
                            </span>
                        ))}
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
};
