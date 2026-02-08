import React from 'react';
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../../state/event-ids';
import type { BuildingRequirement, InputRequirement } from '../types';
import { BuildingImage } from '../../ui/BuildingImage';
import { ItemImage } from '../../ui/ItemImage';
import type { Building } from '../../../state/db';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';

interface BuildingRequirementsModalProps {
    isOpen: boolean;
    buildingRequirements: BuildingRequirement[];
    inputRequirements: InputRequirement[];
    allRequirementsSatisfied: boolean;
    baseId: string;
    sectionId: string;
    onClose: () => void;
}

export const BuildingRequirementsModal: React.FC<BuildingRequirementsModalProps> = ({
    isOpen,
    buildingRequirements,
    inputRequirements,
    allRequirementsSatisfied,
    baseId,
    sectionId,
    onClose,
}) => {
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS_LIST]);

    if (!isOpen) {
        return null;
    }

    const handleAddMissing = () => {
        dispatch([EVENT_IDS.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, baseId, sectionId, 'missing']);
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
                    <h3 className="font-bold text-lg">Manage Buildings</h3>
                    <button
                        type="button"
                        className="btn btn-sm btn-circle btn-ghost"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Inputs Section */}
                {inputRequirements.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold mb-2 text-base-content/70">Inputs</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {inputRequirements.map((req) => {
                                const building = buildings.find(b => b.id === req.buildingId);
                                return (
                                    <div
                                        key={req.baseBuildingId}
                                        className={`flex items-center justify-between text-sm py-2 px-3 rounded-lg border ${req.isSatisfied
                                            ? 'bg-success/10 border-success/30'
                                            : 'bg-error/20 border-error/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {building && (
                                                <BuildingImage
                                                    buildingId={building.id}
                                                    building={building}
                                                    size="small"
                                                    className="w-4 h-4 flex-shrink-0"
                                                />
                                            )}
                                            <ItemImage
                                                itemId={req.itemId}
                                                size="small"
                                                className="w-4 h-4 flex-shrink-0"
                                            />
                                            <span className="truncate flex-1">{req.itemName}</span>
                                            <span className="text-xs text-base-content/60 flex-shrink-0">{req.ratePerMinute}/min</span>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <span className={`badge badge-sm ${req.isSatisfied ? 'badge-success' : 'badge-error'}`}>
                                                {req.isSatisfied ? '✓' : '✗'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Production Buildings Section */}
                <div>
                    <h4 className="text-sm font-semibold mb-2 text-base-content/70">Production Buildings</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {buildingRequirements.length === 0 ? (
                            <p className="text-sm text-base-content/60">No building requirements</p>
                        ) : (
                            buildingRequirements.map((req) => (
                                <div
                                    key={req.buildingId}
                                    className={`flex items-center justify-between text-sm py-2 px-3 rounded-lg border ${req.isSatisfied
                                        ? 'bg-success/10 border-success/30'
                                        : 'bg-warning/20 border-warning/30'
                                        }`}
                                >
                                    <span className="truncate flex-1 mr-3">{req.buildingName}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`badge badge-sm font-mono ${req.isSatisfied ? 'badge-success' : 'badge-warning'
                                            }`}>
                                            {req.available}/{req.required}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                {buildingRequirements.length > 0 && (
                    <div className="mt-4">
                        {!allRequirementsSatisfied && (
                            <>
                                <button
                                    className="btn btn-primary btn-sm w-full mb-2"
                                    onClick={handleAddMissing}
                                >
                                    Add Missing Production Buildings
                                </button>
                                <p className="text-xs text-base-content/60 text-center">
                                    Note: Input buildings must be added manually in the Buildings tab
                                </p>
                            </>
                        )}
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
