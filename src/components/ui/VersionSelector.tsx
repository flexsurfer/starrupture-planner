/**
 * Version Selector Component
 * 
 * A dropdown selector for switching between data versions (Early Access, Playtest).
 */

import { dispatch, useSubscription } from "@flexsurfer/reflex";
import { EVENT_IDS } from "../../state/event-ids";
import { SUB_IDS } from "../../state/sub-ids";
import type { DataVersion } from "../../state/db";

interface VersionSelectorProps {
  className?: string;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ className = "" }) => {
  const currentVersion = useSubscription<DataVersion>([SUB_IDS.DATA_VERSION]);
  const dataVersions = useSubscription<{ id: DataVersion; label: string }[]>([SUB_IDS.DATA_VERSIONS]);

  return (
    <select
      className={`select select-bordered select-xs ${className}`}
      style={{ width: 'auto', minWidth: '100px' }}
      value={currentVersion}
      onChange={(e) => dispatch([EVENT_IDS.SET_DATA_VERSION, e.target.value as DataVersion])}
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
