import { dispatch, useSubscription } from "@flexsurfer/reflex";
import { EVENT_IDS } from "../../state/event-ids";
import { SUB_IDS } from "../../state/sub-ids";

interface ItemsSearchProps {
  className?: string;
}

export const ItemsSearch = ({ className = "" }: ItemsSearchProps) => {
  const searchTerm = useSubscription<string>([SUB_IDS.SEARCH_TERM]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch([EVENT_IDS.SET_SEARCH_TERM, event.target.value]);
  };

  return (
    <div className={`form-control w-full max-w-xs ${className}`}>
      <input
        type="text"
        placeholder="Search items..."
        className="input input-bordered w-full"
        value={searchTerm || ''}
        onChange={handleSearchChange}
      />
    </div>
  );
};
