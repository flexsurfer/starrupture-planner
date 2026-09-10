import { CorporationCard } from './CorporationCard';
import { CorporationsStats } from './CorporationsStats';
import { useCorporations, useCorporationCollapse } from './useCorporations';

const CorporationsPage = () => {
  const { corporationsWithStats, itemsMap } = useCorporations();
  const { collapsedCorporations, toggleCorporation } = useCorporationCollapse(corporationsWithStats);

  return (
    <div className="mx-auto w-full max-w-7xl p-2 sm:p-4">
      <div className="flex flex-col gap-3">
        {/* Header section - responsive */}
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-bold sm:text-xl">Corporations</h1>
          <CorporationsStats />
        </header>

        {/* Corporations Grid */}
        <div className="grid gap-2 sm:gap-3">
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
            <div className="text-base-content/60">No corporations data available</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporationsPage;
