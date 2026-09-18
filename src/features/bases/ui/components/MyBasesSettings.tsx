import { useEffect, useId, useRef } from "react";
import { appIds } from "@/app/uklad/catalog";
import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import type { BasesMode } from "@/features/bases/state";
import { AdvancedModeSwitch } from "./AdvancedModeSwitch";

export const MyBasesSettings = () => {
  const runtime = useRuntime();
  const mode = useSubscription([appIds.subscriptions.BASES_MODE]);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = mode === null;

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [open]);

  const selectMode = (value: BasesMode) => {
    runtime.dispatch([appIds.events.BASES_SET_MODE, value]);
  };

  return (
    <>
      <AdvancedModeSwitch />
      {open && (
        <dialog
          ref={dialog}
          className="modal"
          aria-labelledby={titleId}
          onCancel={(event) => event.preventDefault()}
        >
          <div className="modal-box max-w-xl">
            <h2 id={titleId} className="text-lg font-semibold">
              How would you like to use My Bases?
            </h2>
            <p className="mt-2 text-sm text-base-content/65">
              Choose a mode for all your bases. Use the Advanced switch to
              change it anytime.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => selectMode("planning")}
                aria-pressed={mode === "planning"}
                className={`rounded-lg border p-4 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${mode === "planning" ? "border-primary bg-primary/10" : "border-base-300 bg-base-200"}`}
              >
                <span className="block font-semibold">Planning mode</span>
                <span className="mt-2 block text-sm text-base-content/70">
                  Create production plans and see the buildings and resources
                  you need.
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectMode("advanced")}
                aria-pressed={mode === "advanced"}
                className={`rounded-lg border p-4 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${mode === "advanced" ? "border-primary bg-primary/10" : "border-base-300 bg-base-200"}`}
              >
                <span className="block font-semibold">Advanced mode</span>
                <span className="mt-2 block text-sm text-base-content/70">
                  Keep your bases in sync with what you build in game. Manage
                  buildings, energy, transport, logistics, inputs and outputs.
                </span>
              </button>
            </div>
            <p className="mt-4 text-xs text-base-content/55">
              Changing mode only changes what is shown. Your plans and base
              configuration are kept.
            </p>
          </div>
        </dialog>
      )}
    </>
  );
};
