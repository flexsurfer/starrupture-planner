import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';

export const ModalHeader: React.FC = () => {
    const runtime = useRuntime();
    const { isEditMode } = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA]);

    const handleClose = () => {
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
    };

    return (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-base-300 flex-shrink-0">
            <button
                type="button"
                className="btn btn-sm btn-outline gap-1 flex-shrink-0"
                onClick={handleClose}
                aria-label="Go back"
            >
                ← Back
            </button>
            <h3 className="font-bold text-base lg:text-lg">
                {isEditMode ? 'Edit Production Plan' : 'Create Production Plan'}
            </h3>
        </div>
    );
};
