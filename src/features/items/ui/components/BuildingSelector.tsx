import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";

interface BuildingSelectorProps {
  className?: string;
}

export const BuildingSelector = ({ className = "" }: BuildingSelectorProps) => {
  const runtime = useRuntime();
  const availableBuildings = useSubscription([appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS]);
  const selectedBuilding = useSubscription([appIds.subscriptions.ITEMS_SELECTED_BUILDING]);

  const handleBuildingChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    runtime.dispatch([appIds.events.ITEMS_SET_SELECTED_BUILDING, event.target.value]);
  };

  return (
    <div className={`form-control ${className}`}>
      <select
        className="select select-sm select-bordered w-full"
        value={selectedBuilding || 'all'}
        onChange={handleBuildingChange}
      >
        {availableBuildings.map((building) => (
          <option key={building} value={building}>
            {building === 'all' ? 'All Buildings' : building}
          </option>
        ))}
      </select>
    </div>
  );
};
