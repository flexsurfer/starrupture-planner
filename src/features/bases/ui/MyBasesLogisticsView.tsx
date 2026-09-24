import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import type { BaseLogisticsViewModel } from '@/features/bases/types';
import { LogisticsCanvas } from './logistics-canvas';

const EMPTY_LOGISTICS_MODELS: BaseLogisticsViewModel[] = [];

export const MyBasesLogisticsView: React.FC = () => {
    const { t } = useTranslation();
  const models = useSubscription([appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS]) || EMPTY_LOGISTICS_MODELS;

  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-5 text-sm text-base-content/70">{t("Create at least one base to configure logistics.")}</div>
    );
  }

  return (
    <div className="h-full min-h-0 rounded-lg border border-base-300 bg-base-100 overflow-hidden">
      <LogisticsCanvas />
    </div>
  );
};
