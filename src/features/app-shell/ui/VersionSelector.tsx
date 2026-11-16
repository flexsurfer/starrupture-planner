/**
 * Version Selector Component
 *
 * A dropdown selector for switching between available data versions.
 */

import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { DataVersion } from '@/features/app-shell/data-version';
import { useTranslation } from '@/shared/i18n';
import { getAppRelease, getAppVersion } from '../app-version';

interface VersionSelectorProps {
  className?: string;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  const appVersion = getAppVersion();
  const runtime = useRuntime();
  const currentVersion = useSubscription([appIds.subscriptions.APP_DATA_VERSION]);
  const dataVersions = useSubscription([appIds.subscriptions.APP_DATA_VERSIONS]);
  const loadPending = useSubscription([appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING]);

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <select
        className={`select select-bordered select-xs max-w-full ${loadPending ? "opacity-70" : ""}`}
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
      <span className="max-w-44 break-all text-center font-mono text-[9px] leading-tight text-base-content/60"
        aria-label={t('App version: {version}', { version: appVersion })}
        title={t('App version: {version} · Build: {release}', { version: appVersion, release: getAppRelease() })}>
        v{appVersion}
      </span>
    </div>
  );
};

export default VersionSelector;
