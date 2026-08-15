import { useAppRuntime, useAppSubscription } from "@/state/runtime";
import { appIds } from "@/app/uklad/catalog";

interface ItemsSearchProps {
  className?: string;
}

export const ItemsSearch = ({ className = "" }: ItemsSearchProps) => {
  const runtime = useAppRuntime();
  const searchTerm = useAppSubscription([appIds.subscriptions.ITEMS_SEARCH_TERM]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    runtime.dispatch([appIds.events.ITEMS_SET_SEARCH_TERM, event.target.value]);
  };

  return (
    <div className={`form-control ${className}`}>
      <input
        type="text"
        placeholder="Search items..."
        className="input input-sm input-bordered w-full"
        value={searchTerm || ''}
        onChange={handleSearchChange}
      />
    </div>
  );
};
