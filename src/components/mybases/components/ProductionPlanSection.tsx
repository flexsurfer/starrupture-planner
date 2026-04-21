import React, { useState, useCallback } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { ProductionPlanSectionViewModel } from '../types';
import type { ProductionFlowResult } from '../../planner/core/types';
import { EmbeddedFlowDiagram } from './EmbeddedFlowDiagram';
import { BuildingRequirementsModal } from '../modals';

interface ProductionPlanSectionProps {
    baseId: string;
    sectionId: string;
}

const EMPTY_PRODUCTION_FLOW: ProductionFlowResult = { nodes: [], edges: [], rawMaterialDeficits: [] };

interface ProductionFlowDiagramProps {
    baseId: string;
    sectionId: string;
}

const formatRatePerMinute = (value: number): string => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const ProductionFlowDiagram: React.FC<ProductionFlowDiagramProps> = ({ baseId, sectionId }) => {

    const productionFlow = useSubscription<ProductionFlowResult>([SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId]) || EMPTY_PRODUCTION_FLOW;

    return (
        <div className="h-[400px] border border-base-300 rounded-lg overflow-hidden">
            <EmbeddedFlowDiagram
                productionFlow={productionFlow}
                className="w-full h-full"
                interactive={false}
            />
        </div>
    );
};

export const ProductionPlanSection: React.FC<ProductionPlanSectionProps> = ({ baseId, sectionId }) => {

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showRequirementsModal, setShowRequirementsModal] = useState(false);

    // Single subscription for all component data
    const data = useSubscription<ProductionPlanSectionViewModel>([SUB_IDS.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, sectionId]);

    // Extract values for useCallback dependencies (use safe defaults)
    // These must be extracted before any early returns to satisfy React hooks rules
    const selectedBaseId = data?.selectedBaseId ?? '';
    const section = data?.section;

    // All hooks must be called before any early returns
    const handleEditProductionPlan = useCallback(() => {
        if (section) {
            dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_OPEN, section.id]);
        }
    }, [section]);

    const handleDelete = useCallback(() => {
        if (section && selectedBaseId) {
            dispatch([EVENT_IDS.UI_SHOW_CONFIRMATION_DIALOG,
                'Delete Production Plan',
            `Are you sure you want to delete "${section.name}"? This action cannot be undone.`,
            () => {
                dispatch([EVENT_IDS.PRODUCTION_PLAN_DELETE_SECTION, selectedBaseId, section.id]);
                dispatch([EVENT_IDS.UI_CLOSE_CONFIRMATION_DIALOG]);
            },
            {
                confirmLabel: 'Delete',
                confirmButtonClass: 'btn-error',
            }
            ]);
        }
    }, [selectedBaseId, section]);

    const handleActivate = useCallback(() => {
        if (selectedBaseId && section) {
            dispatch([EVENT_IDS.PRODUCTION_PLAN_ACTIVATE_SECTION, selectedBaseId, section.id]);
        }
    }, [selectedBaseId, section]);

    const handleDeactivate = useCallback(() => {
        if (selectedBaseId && section) {
            dispatch([EVENT_IDS.PRODUCTION_PLAN_DEACTIVATE_SECTION, selectedBaseId, section.id]);
        }
    }, [selectedBaseId, section]);

    if (!data) {
        return null;
    }

    const {
        itemName,
        corporationName,
        stats,
        buildingRequirements,
        inputRequirements,
        sharedInputShortages,
        hasRawMaterialShortage,
        hasMaterialShortage,
        allRequirementsSatisfied,
        hasError,
        showManageButton,
    } = data;
    const showBuildingWarning = !allRequirementsSatisfied;
    const showInputWarning = sharedInputShortages.length > 0;
    const showMaterialWarning = hasRawMaterialShortage;

    const toggleCollapse = () => {
        setIsCollapsed((prev) => !prev);
    };

    return (
        <div className={`card bg-base-100 shadow-lg border ${hasError ? 'border-error/50' : 'border-primary/30'}`}>
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
                                <span className={`badge badge-sm ${
                                    hasError 
                                        ? 'badge-error' 
                                        : section.active 
                                            ? (allRequirementsSatisfied && !hasMaterialShortage ? 'badge-success' : 'badge-warning') 
                                            : 'badge-dash'
                                }`}>
                                    {section.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <p className="text-sm text-base-content/70 mt-1">
                                Producing <span className="font-semibold">{itemName}</span> at <span className="font-semibold">{section.targetAmount}/min</span>
                                {corporationName && (
                                    <>
                                        {' • '}
                                        <span className="text-base-content/70">
                                            {corporationName} Lv.{section.corporationLevel?.level}
                                        </span>
                                    </>
                                )}
                            </p>
                            <div className="flex gap-2 flex-wrap items-center mt-3">
                                <div className={`badge badge-outline ${hasError ? 'badge-error' : allRequirementsSatisfied ? 'badge-success' : 'badge-warning'}`}>
                                    {stats.buildingCount} building{stats.buildingCount !== 1 ? 's' : ''}
                                </div>
                                {showManageButton && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRequirementsModal(true);
                                        }}
                                        className={`btn btn-sm h-6 min-h-6 px-2 ${hasError ? 'btn-error' : 'btn-primary'}`}
                                    >
                                        manage buildings
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
                                disabled={hasError}
                                title={hasError ? 'Cannot activate: inputs are insufficient' : ''}
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
                                handleEditProductionPlan();
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
                    {(showBuildingWarning || showInputWarning || showMaterialWarning) && (
                        <div className="flex flex-col items-end mt-1 space-y-1 text-right" onClick={(e) => e.stopPropagation()}>
                            {showBuildingWarning && (
                                <p className="text-xs text-warning font-medium">
                                    Not enough production buildings in base. Use the &quot;manage buildings&quot; button.
                                </p>
                            )}
                            {showMaterialWarning && (
                                <p className="text-xs text-warning font-medium">
                                    Missing materials for this plan.
                                </p>
                            )}
                            {showInputWarning && sharedInputShortages.map((shortage) => (
                                <p key={shortage.baseBuildingId} className="text-xs text-warning font-medium">
                                    Not enough resources from input &quot;{shortage.inputName}&quot; ({shortage.itemName}):{' '}
                                    {formatRatePerMinute(shortage.availablePerMinute)}/min available,{' '}
                                    {formatRatePerMinute(shortage.requiredPerMinute)}/min required for all plans.
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Collapsible Content */}
                {!isCollapsed && (
                    <ProductionFlowDiagram baseId={baseId} sectionId={sectionId} />
                )}
            </div>

            {/* Building Requirements Modal */}
            <BuildingRequirementsModal
                isOpen={showRequirementsModal}
                buildingRequirements={buildingRequirements}
                inputRequirements={inputRequirements}
                allRequirementsSatisfied={allRequirementsSatisfied}
                baseId={selectedBaseId}
                sectionId={section.id}
                onClose={() => setShowRequirementsModal(false)}
            />
        </div>
    );
};
