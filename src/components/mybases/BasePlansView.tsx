import React, { useCallback } from 'react';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';
import { SUB_IDS } from '../../state/sub-ids';
import {
  ProductionPlanSection as ProductionPlanSectionComponent,
} from './index';

export const BasePlansView: React.FC = () => {
  const selectedBaseId = useSubscription<string | null>([SUB_IDS.BASES_SELECTED_BASE_ID]);
  const sectionIds = useSubscription<string[]>([SUB_IDS.PRODUCTION_PLAN_SECTION_IDS]) || [];

  const handleOpenProductionPlanModal = useCallback(() => {
    dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_OPEN]);
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
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

      {/* Add Production Plan Button */}
      <div className="card bg-base-200 border border-dashed border-base-300 hover:border-primary cursor-pointer transition-colors"
        onClick={handleOpenProductionPlanModal}
      >
        <div className="card-body flex-row items-center justify-center gap-2 py-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-primary"
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
    </div>
  );
};
