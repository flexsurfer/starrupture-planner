import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import {
  ProductionPlanSection as ProductionPlanSectionComponent,
} from './components';

export const BasePlansView: React.FC = () => {
  const selectedBaseId = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_ID]);
  const sectionIds = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS]) || [];

  return (
    <div className="space-y-2 sm:space-y-3">
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
        <div className="rounded-lg border border-dashed border-base-300 px-4 py-8 text-center text-base-content/60">
          <p className="text-sm">No production plans yet. Create a production plan to calculate the buildings needed to produce items at a specific rate.</p>
        </div>
      )}
    </div>
  );
};
