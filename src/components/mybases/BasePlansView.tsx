import { runtime } from '@/app/uklad/bootstrap';
import { appIds } from '@/app/uklad/catalog';
import React, { useCallback } from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import {
  ProductionPlanSection as ProductionPlanSectionComponent,
} from './index';

export const BasePlansView: React.FC = () => {
  const selectedBaseId = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_ID]);
  const sectionIds = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS]) || [];

  const handleOpenProductionPlanModal = useCallback(() => {
    runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Add Production Plan Button */}
      <div className="card bg-base-200 border border-dashed border-base-300 hover:border-base-content/40 cursor-pointer transition-colors"
        onClick={handleOpenProductionPlanModal}
      >
        <div className="card-body flex-row items-center justify-center gap-2 py-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-base-content/55"
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
          <span className="text-sm text-base-content/70">Add Production Plan</span>
        </div>
      </div>

      {/* Production Plan Sections */}
      {selectedBaseId && sectionIds.map((sectionId) => (
        <ProductionPlanSectionComponent
          key={sectionId}
          baseId={selectedBaseId}
          sectionId={sectionId}
        />
      ))}

      {/* Empty state when no plans */}
      {sectionIds.length === 0 && (
        <div className="text-center text-base-content/60">
          <p className="text-sm">No production plans yet. Create a production plan to calculate the buildings needed to produce items at a specific rate.</p>
        </div>
      )}
    </div>
  );
};
