import { useCorporations, useCorporationCollapse, CorporationCard, CorporationsStats } from "./corporations";

const CorporationsPage = () => {
  const { corporationsWithStats, itemsMap } = useCorporations();
  const { collapsedCorporations, toggleCorporation } = useCorporationCollapse(corporationsWithStats);

  return (
    <div className="h-full p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:gap-6">
        {/* Header section - responsive */}
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
          <h1 className="text-2xl lg:text-3xl font-bold">Corporations</h1>
          <CorporationsStats  />
        </div>

        {/* Corporations Grid */}
        <div className="grid gap-4 lg:gap-6">
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
