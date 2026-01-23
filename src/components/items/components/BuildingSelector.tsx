import { dispatch, useSubscription } from "@flexsurfer/reflex";
import { EVENT_IDS } from "../../../state/event-ids";
import { SUB_IDS } from "../../../state/sub-ids";

interface BuildingSelectorProps {
  className?: string;
}

export const BuildingSelector = ({ className = "" }: BuildingSelectorProps) => {
  const availableBuildings = useSubscription<string[]>([SUB_IDS.AVAILABLE_BUILDINGS]);
  const selectedBuilding = useSubscription<string>([SUB_IDS.SELECTED_BUILDING]);

  const handleBuildingChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch([EVENT_IDS.SET_SELECTED_BUILDING, event.target.value]);
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
