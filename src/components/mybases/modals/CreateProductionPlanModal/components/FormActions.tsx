import React, { useCallback } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import { EVENT_IDS } from '../../../../../state/event-ids';

interface FormActionsData {
    isEditMode: boolean;
}

export const FormActions: React.FC = () => {
    const { isEditMode } = useSubscription<FormActionsData>([SUB_IDS.PRODUCTION_PLAN_MODAL_HEADER_DATA]);
    const isFormValid = useSubscription<boolean>([SUB_IDS.PRODUCTION_PLAN_MODAL_FORM_VALIDITY]);

    const handleClose = useCallback(() => {
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_CLOSE]);
    }, []);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_SUBMIT]);
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
