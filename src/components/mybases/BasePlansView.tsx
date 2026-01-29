import React, { useCallback, useState } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import type { ProductionPlanSection as ProductionPlanSectionData } from '../../state/db';
import { EVENT_IDS } from '../../state/event-ids';
import { SUB_IDS } from '../../state/sub-ids';
import type { Base } from '../../state/db';
import {
  ProductionPlanSection as ProductionPlanSectionComponent,
  CreateProductionPlanModal,
  ActivatePlanDialog,
} from './index';

export const BasePlansView: React.FC = () => {
  const [showProductionPlanModal, setShowProductionPlanModal] = useState(false);
  const [editingProductionPlan, setEditingProductionPlan] = useState<ProductionPlanSectionData | null>(null);

  const selectedBase = useSubscription<Base | null>([SUB_IDS.SELECTED_BASE]);

  const handleOpenProductionPlanModal = useCallback(() => {
    setEditingProductionPlan(null);
    setShowProductionPlanModal(true);
  }, []);

  const handleEditProductionPlan = useCallback((section: ProductionPlanSectionData) => {
    setEditingProductionPlan(section);
    setShowProductionPlanModal(true);
  }, []);

  const handleCloseProductionPlanModal = useCallback(() => {
    setShowProductionPlanModal(false);
    setEditingProductionPlan(null);
  }, []);

  const handleCreateProductionPlan = useCallback((name: string, selectedItemId: string, targetAmount: number, corporationLevel?: { corporationId: string; level: number } | null) => {
    if (selectedBase) {
      dispatch([EVENT_IDS.CREATE_PRODUCTION_PLAN_SECTION, selectedBase.id, name, selectedItemId, targetAmount, corporationLevel]);
    }
  }, [selectedBase]);

  const handleUpdateProductionPlan = useCallback((sectionId: string, name: string, selectedItemId: string, targetAmount: number, corporationLevel?: { corporationId: string; level: number } | null) => {
    if (selectedBase) {
      dispatch([EVENT_IDS.UPDATE_PRODUCTION_PLAN_SECTION, selectedBase.id, sectionId, name, selectedItemId, targetAmount, corporationLevel]);
    }
  }, [selectedBase]);

  if (!selectedBase) {
    return null;
  }

  return (
    <>
      <div className="space-y-4 lg:space-y-6">
        {/* Production Plan Sections */}
        {selectedBase.productionPlanSections?.map((section) => (
          <ProductionPlanSectionComponent
            key={section.id}
            section={section}
            baseId={selectedBase.id}
            onEdit={handleEditProductionPlan}
          />
        ))}

        {/* Empty state when no plans */}
        {(!selectedBase.productionPlanSections || selectedBase.productionPlanSections.length === 0) && (
          <div className="text-center text-base-content/60">
            <p className="text-sm">No production plans yet. Create a production plan to calculate the buildings needed to produce items at a specific rate.</p>
          </div>
        )}

        {/* Add Production Plan Button */}
        <div className="card bg-base-200 border border-dashed border-base-300 hover:border-primary cursor-pointer transition-colors"
          onClick={handleOpenProductionPlanModal}
        >
          <div className="card-body items-center justify-center py-8">
            <div className="btn btn-circle btn-primary btn-sm pointer-events-none mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <span className="text-sm text-base-content/70">Add Production Plan</span>
          </div>
        </div>


      </div>

      {/* Modals */}
      <CreateProductionPlanModal
        isOpen={showProductionPlanModal}
        onClose={handleCloseProductionPlanModal}
        onCreate={handleCreateProductionPlan}
        onUpdate={handleUpdateProductionPlan}
        editSection={editingProductionPlan}
        baseId={selectedBase.id}
      />
      <ActivatePlanDialog />
    </>
  );
};
