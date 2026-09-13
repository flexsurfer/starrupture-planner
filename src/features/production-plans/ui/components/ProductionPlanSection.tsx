import { appIds } from '@/app/uklad/catalog';
import React, { useState, useCallback, useId } from 'react';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { ProductionFlowResult } from '@/features/planner/types';
import { PlanDiagram } from './PlanDiagram';
import { ItemImage, SectionIcon } from '@/shared/ui';
import { BuildingRequirementsModal } from '../modals';
import { getPlanOutputAllocationSummary } from '@/utils/planOutputAllocations';

interface ProductionPlanSectionProps {
    baseId: string;
    sectionId: string;
}

const EMPTY_PRODUCTION_FLOW: ProductionFlowResult = { nodes: [], edges: [], rawMaterialDeficits: [] };

interface ProductionFlowDiagramProps {
    baseId: string;
    sectionId: string;
    name: string;
    targetItemId: string;
}

const formatRatePerMinute = (value: number | undefined): string => {
    if (!value || value <= 0) return '0';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const ProductionFlowDiagram: React.FC<ProductionFlowDiagramProps> = ({ baseId, sectionId, name, targetItemId }) => {
    const productionFlow = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId]) || EMPTY_PRODUCTION_FLOW;

    return <PlanDiagram productionFlow={productionFlow} name={name} targetItemId={targetItemId} />;
};

export const ProductionPlanSection: React.FC<ProductionPlanSectionProps> = ({ baseId, sectionId }) => {
    const runtime = useRuntime();
    const diagramId = useId();
    const items = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showRequirementsModal, setShowRequirementsModal] = useState(false);

    // Single subscription for all component data
    const data = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, sectionId]);
    const allBases = useSubscription([appIds.subscriptions.BASES_LIST]) || [];

    // Extract values for useCallback dependencies (use safe defaults)
    // These must be extracted before any early returns to satisfy React hooks rules
    const selectedBaseId = data?.selectedBaseId ?? '';
    const section = data?.section;

    // All hooks must be called before any early returns
    const handleEditProductionPlan = useCallback(() => {
        if (section) {
            runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, section.id]);
        }
    }, [runtime, section]);

    const handleDelete = useCallback(() => {
        if (section && selectedBaseId) {
            runtime.dispatch([appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
                'Delete Production Plan',
            `Are you sure you want to delete "${section.name}"? This action cannot be undone.`,
            () => {
                runtime.dispatch([appIds.events.PRODUCTION_PLAN_DELETE_SECTION, selectedBaseId, section.id]);
                runtime.dispatch([appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]);
            },
            {
                confirmLabel: 'Delete',
                confirmButtonClass: 'btn-error',
            }
            ]);
        }
    }, [runtime, selectedBaseId, section]);

    const handleActivate = useCallback(() => {
        if (selectedBaseId && section) {
            runtime.dispatch([appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, selectedBaseId, section.id]);
        }
    }, [runtime, selectedBaseId, section]);

    const handleDeactivate = useCallback(() => {
        if (selectedBaseId && section) {
            runtime.dispatch([appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, selectedBaseId, section.id]);
        }
    }, [runtime, selectedBaseId, section]);

    if (!data || !section) {
        return null;
    }

    const {
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
    const base = allBases.find((candidate) => candidate.id === selectedBaseId);
    const outputSummary = base && section
        ? getPlanOutputAllocationSummary(base, section.id)
        : null;
    const hasLinkedOutputs = !!outputSummary && outputSummary.outputs.length > 0;

    const item = items[section.selectedItemId];
    const statusColor = hasError ? 'text-error' : section.active
        ? (allRequirementsSatisfied && !hasMaterialShortage ? 'text-success' : 'text-warning')
        : 'text-base-content/60';
    const warningLabels = [showBuildingWarning && 'buildings', showMaterialWarning && 'materials', showInputWarning && 'inputs'].filter(Boolean);

    return (
        <section className={`min-w-0 rounded-lg border bg-base-100 ${hasError ? 'border-error/50' : 'border-base-300'}`}>
            <header className="rounded-t-lg border-b border-base-300 bg-base-200 p-2 sm:p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="min-w-0 flex-1 basis-full sm:basis-auto">
                        <button type="button" className="flex w-full min-w-0 items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-primary"
                            aria-label={section.name} aria-expanded={!isCollapsed} aria-controls={diagramId}
                            onClick={() => setIsCollapsed(previous => !previous)}>
                            <svg aria-hidden="true" className={`size-4 shrink-0 text-base-content/50 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="shrink-0 [&>div]:size-7 [&_img]:size-7"><ItemImage itemId={section.selectedItemId} item={item} size="small" /></span>
                            <span className="min-w-0 text-sm font-semibold leading-snug break-words sm:text-base">{section.name}</span>
                            <span className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${statusColor}`}>
                                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                                {section.active ? 'Active' : 'Inactive'}
                            </span>
                        </button>
                    </h2>
                    <div className="flex flex-wrap items-center gap-1">
                        {showManageButton && <button type="button" onClick={() => setShowRequirementsModal(true)}
                            className="btn btn-sm btn-ghost h-8 min-h-8 px-2 text-xs" title="Manage production buildings">
                            <SectionIcon name="buildings" className="size-4" />
                            Manage
                        </button>}
                        <button type="button" className="btn btn-sm btn-outline h-8 min-h-8 px-2 text-xs"
                            onClick={section.active ? handleDeactivate : handleActivate} disabled={!section.active && hasError}
                            title={!section.active && hasError ? 'Cannot activate: inputs are insufficient' : undefined}>
                            {section.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="btn btn-sm btn-primary h-8 min-h-8 px-2 text-xs" onClick={handleEditProductionPlan}>Edit</button>
                        <button type="button" className="btn btn-sm btn-ghost h-8 min-h-8 w-8 p-0 text-base-content/50 hover:text-error"
                            aria-label={`Delete ${section.name}`} title="Delete production plan" onClick={handleDelete}>
                            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-base-content/65 tabular-nums sm:text-xs">
                    <span className="inline-flex items-center gap-1" aria-label={`${stats.buildingCount} ${stats.buildingCount === 1 ? 'building' : 'buildings'}`} title="Buildings">
                        <SectionIcon name="buildings" className="size-4" />
                        {stats.buildingCount}
                    </span>
                    {stats.totalHeat > 0 && <span title="Heat">🔥 {stats.totalHeat}</span>}
                    {stats.totalPowerConsumption > 0 && <span title="Power consumption">⚡ {stats.totalPowerConsumption} MW</span>}
                    {corporationName && <span>{corporationName} Lv.{section.corporationLevel?.level}</span>}
                    {hasLinkedOutputs && outputSummary && <span className={outputSummary.remainingRatePerMinute > 0 ? 'text-warning' : ''}
                        title={`${formatRatePerMinute(outputSummary.remainingRatePerMinute)}/min remaining`}>
                        Outputs {formatRatePerMinute(outputSummary.assignedRatePerMinute)}/min assigned
                    </span>}
                </div>
            </header>
            {warningLabels.length > 0 && <details className="border-b border-base-300 px-2 py-1.5 text-xs sm:px-3">
                <summary className="cursor-pointer text-warning">Requirements need attention: {warningLabels.join(', ')}</summary>
                <ul className="mt-2 space-y-1 pb-1 text-base-content/75">
                    {showBuildingWarning && <li>Not enough production buildings in base. Use Manage to add them.</li>}
                    {showMaterialWarning && <li>Missing materials for this plan.</li>}
                    {sharedInputShortages.map(shortage => <li key={shortage.baseBuildingId}>
                        Not enough resources from input &quot;{shortage.inputName}&quot; ({shortage.itemName}):{' '}
                        {formatRatePerMinute(shortage.availablePerMinute)}/min available, {formatRatePerMinute(shortage.requiredPerMinute)}/min required for all plans.
                    </li>)}
                </ul>
            </details>}
            <div id={diagramId} hidden={isCollapsed}>
                {!isCollapsed && <ProductionFlowDiagram baseId={baseId} sectionId={sectionId} name={section.name} targetItemId={section.selectedItemId} />}
            </div>
            <BuildingRequirementsModal
                isOpen={showRequirementsModal}
                buildingRequirements={buildingRequirements}
                inputRequirements={inputRequirements}
                allRequirementsSatisfied={allRequirementsSatisfied}
                baseId={selectedBaseId}
                sectionId={section.id}
                onClose={() => setShowRequirementsModal(false)}
            />
        </section>
    );
};
