import React from 'react';
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../../state/event-ids';
import type { BuildingRequirement } from '../types';

interface BuildingRequirementsModalProps {
    isOpen: boolean;
    buildingRequirements: BuildingRequirement[];
    allRequirementsSatisfied: boolean;
    baseId: string;
    sectionId: string;
    onClose: () => void;
}

export const BuildingRequirementsModal: React.FC<BuildingRequirementsModalProps> = ({
    isOpen,
    buildingRequirements,
    allRequirementsSatisfied,
    baseId,
    sectionId,
    onClose,
}) => {
    if (!isOpen) {
        return null;
    }

    const handleAddMissing = () => {
        dispatch([EVENT_IDS.ACTIVATE_PRODUCTION_PLAN_SECTION, baseId, sectionId, 'missing']);
        onClose();
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="modal modal-open" 
            onClick={handleBackdropClick}
        >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Building Requirements</h3>
                    <button
                        type="button"
                        className="btn btn-sm btn-circle btn-ghost"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {buildingRequirements.length === 0 ? (
                        <p className="text-sm text-base-content/60">No building requirements</p>
                    ) : (
                        buildingRequirements.map((req) => (
                            <div
                                key={req.buildingId}
                                className={`flex items-center justify-between text-sm py-2 px-3 rounded-lg border ${
                                    req.isSatisfied 
                                        ? 'bg-success/10 border-success/30' 
                                        : 'bg-warning/20 border-warning/30'
                                }`}
                            >
                                <span className="truncate flex-1 mr-3">{req.buildingName}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`badge badge-sm font-mono ${
                                        req.isSatisfied ? 'badge-success' : 'badge-warning'
                                    }`}>
                                        {req.available}/{req.required}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {!allRequirementsSatisfied && (
                    <div className="mt-4">
                        <button
                            className="btn btn-primary btn-sm w-full mb-2"
                            onClick={handleAddMissing}
                        >
                            Add Missing Buildings and Activate Plan
                        </button>
                        <p className="text-xs text-base-content/60 text-center">
                            Or add missing buildings manually in the Buildings tab
                        </p>
                    </div>
                )}
                <div className="modal-action">
                    <button
                        className="btn btn-sm"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
