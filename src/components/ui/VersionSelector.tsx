/**
 * Version Selector Component
 *
 * A dropdown selector for switching between available data versions.
 */

import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { DataVersion } from "@/state/db";

interface VersionSelectorProps {
  className?: string;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ className = "" }) => {
  const runtime = useRuntime();
  const currentVersion = useSubscription([appIds.subscriptions.APP_DATA_VERSION]);
  const dataVersions = useSubscription([appIds.subscriptions.APP_DATA_VERSIONS]);
  const loadPending = useSubscription([appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING]);

  return (
    <select
      className={`select select-bordered select-xs ${className} ${loadPending ? "opacity-70" : ""}`}
      style={{ width: 'auto', minWidth: '100px' }}
      value={currentVersion}
      disabled={loadPending}
      aria-busy={loadPending}
      onChange={(e) => {
        const next = e.target.value as DataVersion;
        if (next === currentVersion || loadPending) return;
        runtime.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, next]);
      }}
    >
      {dataVersions.map((version) => (
        <option key={version.id} value={version.id}>
          {version.label}
        </option>
      ))}
    </select>
  );
};

export default VersionSelector;
