/**
 * Version Selector Component
 *
 * A dropdown selector for switching between available data versions.
 */

import { useId } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { DEFAULT_DATA_VERSION, type DataVersion } from '@/features/app-shell/data-version';
import { useTranslation } from '@/shared/i18n';
import { getAppRelease, getAppVersion } from '../app-version';

interface VersionSelectorProps {
  className?: string;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  const versionWarningId = useId();
  const appVersion = getAppVersion();
  const runtime = useRuntime();
  const currentVersion = useSubscription([appIds.subscriptions.APP_DATA_VERSION]);
  const dataVersions = useSubscription([appIds.subscriptions.APP_DATA_VERSIONS]);
  const loadPending = useSubscription([appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING]);
  const latestVersion = dataVersions.find(version => version.id === DEFAULT_DATA_VERSION);
  const versionWarning = latestVersion && currentVersion !== latestVersion.id
    ? t('An outdated game data version is selected. Recommended version: {version}.', { version: latestVersion.label })
    : null;

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <div className="flex max-w-full items-center gap-1.5">
        <select
          className={`select select-bordered select-xs max-w-full ${loadPending ? "opacity-70" : ""}`}
          style={{ width: 'auto', minWidth: '100px' }}
          value={currentVersion}
          disabled={loadPending}
          aria-label={t('Game data version')}
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
        {versionWarning && <span className="group relative inline-flex shrink-0">
          <button type="button" aria-labelledby={versionWarningId}
            className="inline-flex cursor-help rounded text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning">
            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 22 21H2L12 3Z" />
              <path d="M12 9v4m0 4h.01" />
            </svg>
          </button>
          <span id={versionWarningId} role="tooltip"
            className="invisible absolute left-1/2 top-full z-30 w-52 -translate-x-1/2 pt-2 group-hover:visible group-focus-within:visible sm:w-64">
            <span className="block rounded-md border border-base-content/15 bg-base-300 px-3 py-2 text-left text-xs font-normal leading-relaxed text-base-content shadow-lg">
              {versionWarning}
            </span>
          </span>
        </span>}
      </div>
      <span className="max-w-44 break-all text-center font-mono text-[9px] leading-tight text-base-content/60"
        aria-label={t('App version: {version}', { version: appVersion })}
        title={t('App version: {version} · Build: {release}', { version: appVersion, release: getAppRelease() })}>
        v{appVersion}
      </span>
    </div>
  );
};

export default VersionSelector;
