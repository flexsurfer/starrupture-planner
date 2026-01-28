import React, { useState, useCallback } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { ProductionPlanSection as ProductionPlanSectionType, Base } from '../../../state/db';
import type { BuildingRequirement } from '../types';
import { EmbeddedFlowDiagram } from './EmbeddedFlowDiagram';
import { BuildingRequirementsModal } from '../modals';

interface ProductionPlanSectionProps {
    section: ProductionPlanSectionType;
    baseId: string;
    onEdit: (section: ProductionPlanSectionType) => void;
}

export const ProductionPlanSection: React.FC<ProductionPlanSectionProps> = ({ section, baseId, onEdit }) => {

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showRequirementsModal, setShowRequirementsModal] = useState(false);

    // Get data from subscriptions
    const base = useSubscription<Base | null>([SUB_IDS.SELECTED_BASE]);

    // Get computed values from subscriptions
    const itemName = useSubscription<string>([SUB_IDS.PRODUCTION_PLAN_SECTION_ITEM_NAME, section.selectedItemId]) || section.selectedItemId;

    const stats = useSubscription<{ buildingCount: number; totalHeat: number; totalPowerConsumption: number }>(
        [SUB_IDS.PRODUCTION_PLAN_SECTION_STATS, section.selectedItemId, section.targetAmount, section.corporationLevel]
    ) || { buildingCount: 0, totalHeat: 0, totalPowerConsumption: 0 };

    const requirementsData = useSubscription<{
        buildingRequirements: BuildingRequirement[];
        allRequirementsSatisfied: boolean;
    }>([SUB_IDS.PRODUCTION_PLAN_SECTION_BUILDING_REQUIREMENTS, baseId, section.id]) || {
        buildingRequirements: [],
        allRequirementsSatisfied: false
    };
    const { buildingRequirements, allRequirementsSatisfied } = requirementsData;

    const handleDelete = useCallback(() => {
        dispatch([EVENT_IDS.SHOW_CONFIRMATION_DIALOG,
            'Delete Production Plan',
        `Are you sure you want to delete "${section.name}"? This action cannot be undone.`,
        () => {
            dispatch([EVENT_IDS.DELETE_PRODUCTION_PLAN_SECTION, baseId, section.id]);
            dispatch([EVENT_IDS.CLOSE_CONFIRMATION_DIALOG]);
        },
        {
            confirmLabel: 'Delete',
            confirmButtonClass: 'btn-error',
        }
        ]);
    }, [baseId, section.id, section.name]);

    const handleActivate = useCallback(() => {
        if (!base) return;
        dispatch([EVENT_IDS.SHOW_ACTIVATE_PLAN_DIALOG, section.name, baseId, section.id, allRequirementsSatisfied]);
    }, [base, baseId, section.id, section.name, allRequirementsSatisfied]);

    const handleDeactivate = useCallback(() => {
        dispatch([EVENT_IDS.DEACTIVATE_PRODUCTION_PLAN_SECTION, baseId, section.id]);
    }, [baseId, section.id]);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className="card bg-base-100 shadow-lg border border-primary/30">
            <div className="card-body">
                {/* Collapsible Header */}
                <div className="flex flex-col gap-3 mb-4 -mx-4 -mt-4 px-4 pt-4 pb-4 rounded-t-lg sticky top-0 z-10 bg-base-100 border-b border-base-300">
                    {/* Top row: Title and badges */}
                    <div
                        className="flex items-center gap-4 cursor-pointer hover:bg-base-200 -mx-2 px-2 py-1 rounded transition-colors"
                        onClick={toggleCollapse}
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h2 className="card-title text-xl">{section.name}</h2>
                                <span className={`badge badge-sm ${section.active ? (allRequirementsSatisfied ? 'badge-success' : 'badge-warning') : 'badge-dash'}`}>
                                    {section.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <p className="text-sm text-base-content/70 mt-1">
                                Producing <span className="font-semibold">{itemName}</span> at <span className="font-semibold">{section.targetAmount}/min</span>
                            </p>
                            <div className="flex gap-2 flex-wrap items-center mt-3">
                                <div className={`badge badge-outline ${allRequirementsSatisfied ? 'badge-success' : 'badge-warning'}`}>
                                    {stats.buildingCount} building{stats.buildingCount !== 1 ? 's' : ''}
                                </div>
                                {!allRequirementsSatisfied && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRequirementsModal(true);
                                        }}
                                        className={`btn btn-sm h-6 min-h-6 px-2 btn-primary`}
                                    >
                                        <>
                                            show buildings
                                        </>
                                    </button>
                                )}
                                {stats.totalHeat > 0 && (
                                    <>
                                        <span className="text-xs text-base-content/40">|</span>
                                        <span className="text-sm">🔥 {stats.totalHeat}</span>
                                    </>
                                )}
                                {stats.totalPowerConsumption > 0 && (
                                    <>
                                        <span className="text-xs text-base-content/40">|</span>
                                        <span className="text-sm">⚡ -{stats.totalPowerConsumption} MW</span>
                                    </>
                                )}
                            </div>
                        </div>
                        {/* Collapse Arrow */}
                        <div className="flex-shrink-0">
                            <svg
                                className={`w-6 h-6 text-base-content transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>

                    {/* Action buttons row - doesn't scroll */}
                    <div className="flex gap-2 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                        {section.active ? (
                            <button
                                className="btn btn-sm btn-outline btn-warning"
                                onClick={handleDeactivate}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Deactivate
                            </button>
                        ) : (
                            <button
                                className="btn btn-sm btn-outline btn-primary"
                                onClick={handleActivate}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Activate
                            </button>
                        )}
                        <button
                            className="btn btn-sm btn-outline btn-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(section);
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                        </button>
                        <button
                            className="btn btn-sm btn-outline btn-error"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete();
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>

                {/* Collapsible Content */}
                {!isCollapsed && (
                    <div className="h-[400px] border border-base-300 rounded-lg overflow-hidden">
                        <EmbeddedFlowDiagram
                            selectedItemId={section.selectedItemId}
                            targetAmount={section.targetAmount}
                            className="w-full h-full"
                            interactive={false}
                            includeLauncher={section.corporationLevel !== null && section.corporationLevel !== undefined}
                        />
                    </div>
                )}
            </div>

            {/* Building Requirements Modal */}
            <BuildingRequirementsModal
                isOpen={showRequirementsModal}
                buildingRequirements={buildingRequirements}
                allRequirementsSatisfied={allRequirementsSatisfied}
                baseId={baseId}
                sectionId={section.id}
                onClose={() => setShowRequirementsModal(false)}
            />
        </div>
    );
};
