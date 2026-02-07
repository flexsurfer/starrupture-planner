import React from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../state/sub-ids';
import {
    ModalHeader,
    InputsSelector,
    FormControls,
    DeficitsAlert,
    DiagramSection,
    FormActions,
} from './components';

interface ModalOpenState {
    isOpen: boolean;
}

export const CreateProductionPlanModal: React.FC = () => {
    // Subscribe to modal open state
    const { isOpen } = useSubscription<ModalOpenState>([SUB_IDS.PRODUCTION_PLAN_MODAL_OPEN_STATE]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="fixed inset-0 flex flex-col bg-base-100 z-50">
                {/* Header with title and close button */}
                <ModalHeader />

                {/* Select Inputs section */}
                <InputsSelector />

                {/* Controls section */}
                <form onSubmit={(e) => e.preventDefault()} className="flex flex-col flex-1 min-h-0">
                    <FormControls />

                    {/* Raw Material Deficits Alert */}
                    <DeficitsAlert />

                    {/* Diagram section - takes all remaining space */}
                    <DiagramSection />

                    {/* Action buttons at bottom */}
                    <FormActions />
                </form>
            </div>
        </div>
    );
};
