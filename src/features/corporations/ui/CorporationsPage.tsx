import { useTranslation } from '@/shared/i18n';
import { CorporationCard } from './CorporationCard';
import { CorporationsStats } from './CorporationsStats';
import { useCorporations, useCorporationCollapse } from './useCorporations';
import './CorporationsPage.css';

const CorporationsPage = () => {
  const { t } = useTranslation();
  const { corporationsWithStats, itemsMap } = useCorporations();
  const { collapsedCorporations, toggleCorporation } = useCorporationCollapse(corporationsWithStats);

  return (
    <div className="corporations-page mx-auto w-full max-w-7xl px-3 py-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('Corporations')}</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-base-content/75">
              {t('Compare level rewards and the supplies needed to unlock them.')}
            </p>
          </div>
          <CorporationsStats />
        </header>

        <div className="grid gap-4">
          {corporationsWithStats.map((corporation) => (
            <CorporationCard
              key={corporation.name}
              corporation={corporation}
              isCollapsed={collapsedCorporations.has(corporation.name)}
              onToggle={() => toggleCorporation(corporation.name)}
              itemsMap={itemsMap}
            />
          ))}
        </div>

        {corporationsWithStats.length === 0 && (
          <div className="text-center py-8">
            <div className="text-base-content/60">{t("No corporations data available")}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporationsPage;
