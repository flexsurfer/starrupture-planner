import React from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import { EVENT_IDS } from '../../../../../state/event-ids';

interface ModalHeaderData {
    isEditMode: boolean;
}

export const ModalHeader: React.FC = () => {
    const { isEditMode } = useSubscription<ModalHeaderData>([SUB_IDS.PRODUCTION_PLAN_MODAL_HEADER_DATA]);

    const handleClose = () => {
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_CLOSE]);
    };

    return (
        <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 flex-shrink-0">
            <h3 className="font-bold text-base lg:text-lg">
                {isEditMode ? 'Edit Production Plan' : 'Create Production Plan'}
            </h3>
            <button
                type="button"
                className="btn btn-xs btn-circle btn-ghost"
                onClick={handleClose}
                aria-label="Close modal"
            >
                ✕
            </button>
        </div>
    );
};
