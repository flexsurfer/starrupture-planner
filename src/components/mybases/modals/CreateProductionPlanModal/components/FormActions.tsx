import { runtime } from '@/app/uklad/bootstrap';
import { appIds } from '@/app/uklad/catalog';
import React, { useCallback } from 'react';
import { useSubscription } from '@/app/uklad/bindings';

export const FormActions: React.FC = () => {
    const { isEditMode } = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA]);
    const isFormValid = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY]);

    const handleClose = useCallback(() => {
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
    }, []);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        handleClose();
    }, [handleClose]);

    return (
        <div className="flex-shrink-0 p-4 border-t border-base-300 flex justify-end gap-2">
            <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleClose}
            >
                Cancel
            </button>
            <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={!isFormValid}
                onClick={handleSubmit}
            >
                {isEditMode ? 'Save Changes' : 'Create Plan'}
            </button>
        </div>
    );
};
