import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import {
    ModalHeader,
    InputsSelector,
    FormControls,
    DeficitsAlert,
    DiagramSection,
    FormActions,
} from './components';

export const CreateProductionPlanModal: React.FC = () => {
    // Subscribe to modal open state
    const { isOpen } = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-x-0 bottom-0 top-20 lg:top-16 flex flex-col bg-base-100 z-50">
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
    );
};
