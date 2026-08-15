import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import type { BaseLogisticsViewModel } from './types';
import { LogisticsCanvas } from './logistics-canvas';

const EMPTY_LOGISTICS_MODELS: BaseLogisticsViewModel[] = [];

export const MyBasesLogisticsView: React.FC = () => {
  const models = useSubscription([appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS]) || EMPTY_LOGISTICS_MODELS;

  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/70">
        Create at least one base to configure logistics.
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="rounded-lg border border-base-300 bg-base-100 overflow-hidden" style={{ height: '70vh' }}>
        <LogisticsCanvas />
      </div>
    </div>
  );
};
