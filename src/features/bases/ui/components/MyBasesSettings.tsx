import { useTranslation } from '@/shared/i18n';
import { useId } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { BasesMode } from '@/features/bases/state';
import { AdvancedModeSwitch } from './AdvancedModeSwitch';

export const MyBasesSettings = () => {
    const { t } = useTranslation();
  const runtime = useRuntime();
  const mode = useSubscription([appIds.subscriptions.BASES_MODE]);
  const titleId = useId();
  const open = mode === null;

  const selectMode = (value: BasesMode) => {
    runtime.dispatch([appIds.events.BASES_SET_MODE, value]);
  };

  return <>
    <AdvancedModeSwitch />
    {/* Keep the first-time picker within the tab content so global navigation stays available. */}
    {open && <div role="dialog" aria-labelledby={titleId}
      className="absolute inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-box bg-base-100 p-6 shadow-2xl">
        <h2 id={titleId} className="text-lg font-semibold">{t("How would you like to use My Bases?")}</h2>
        <p className="mt-2 text-sm text-base-content/65">{t("Choose a mode for all your bases. Use the Advanced switch to change it anytime.")}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => selectMode('planning')} aria-pressed={mode === 'planning'}
            className={`rounded-lg border p-4 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${mode === 'planning' ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200'}`}>
            <span className="block font-semibold">{t("Planning mode")}</span>
            <span className="mt-2 block text-sm text-base-content/70">{t("Create production plans and see the buildings and resources you need.")}</span>
          </button>
          <button type="button" onClick={() => selectMode('advanced')} aria-pressed={mode === 'advanced'}
            className={`rounded-lg border p-4 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${mode === 'advanced' ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200'}`}>
            <span className="block font-semibold">{t("Advanced mode")}</span>
            <span className="mt-2 block text-sm text-base-content/70">{t("Keep your bases in sync with what you build in game. Manage buildings, energy, transport, logistics, inputs and outputs.")}</span>
          </button>
        </div>
        <p className="mt-4 text-xs text-base-content/55">{t("Changing mode only changes what is shown. Your plans and base configuration are kept.")}</p>
      </div>
    </div>}
  </>;
};
