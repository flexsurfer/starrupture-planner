import { useCodexView } from '@/shared/ui/CodexViewContext';
import { useTranslation } from '@/shared/i18n';
import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";

interface ItemsSearchProps {
  className?: string;
}

export const ItemsSearch = ({ className = "" }: ItemsSearchProps) => {
  const codex = useCodexView();
    const { t } = useTranslation();
  const runtime = useRuntime();
  const searchTerm = useSubscription([codex ? appIds.subscriptions.ITEMS_CODEX_SEARCH_TERM : appIds.subscriptions.ITEMS_SEARCH_TERM]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    runtime.dispatch([codex ? appIds.events.ITEMS_CODEX_SET_SEARCH_TERM : appIds.events.ITEMS_SET_SEARCH_TERM, event.target.value]);
  };

  return (
    <div className={`form-control ${className}`}>
      <input
        type="text"
        placeholder={t("Search items...")}
        className="input input-sm input-bordered w-full"
        value={searchTerm || ''}
        onChange={handleSearchChange}
      />
    </div>
  );
};
