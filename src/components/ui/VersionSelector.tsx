/**
 * Version Selector Component
 *
 * A dropdown selector for switching between available data versions.
 */

import { dispatch, useSubscription } from "@flexsurfer/reflex";
import { EVENT_IDS } from "../../state/event-ids";
import { SUB_IDS } from "../../state/sub-ids";
import type { DataVersion } from "../../state/db";

interface VersionSelectorProps {
  className?: string;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ className = "" }) => {
  const currentVersion = useSubscription<DataVersion>([SUB_IDS.APP_DATA_VERSION]);
  const dataVersions = useSubscription<{ id: DataVersion; label: string }[]>([SUB_IDS.APP_DATA_VERSIONS]);
  const loadPending = useSubscription<boolean>([SUB_IDS.UI_GAME_DATA_LOAD_PENDING]);

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
        dispatch([EVENT_IDS.APP_REQUEST_LOAD_GAME_DATA, next]);
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
