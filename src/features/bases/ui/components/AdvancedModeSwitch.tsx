import { appIds } from "@/app/uklad/catalog";
import { useRuntime, useSubscription } from "@/app/uklad/bindings";

export const AdvancedModeSwitch = () => {
  const runtime = useRuntime();
  const mode = useSubscription([appIds.subscriptions.BASES_MODE]);

  return (
    <label
      className="flex h-8 shrink-0 cursor-pointer items-center gap-2 px-2 text-xs"
      title="Switch between Planning and Advanced mode for all bases"
    >
      <input
        type="checkbox"
        role="switch"
        className="toggle toggle-xs toggle-primary"
        checked={mode === "advanced"}
        onChange={(event) =>
          runtime.dispatch([
            appIds.events.BASES_SET_MODE,
            event.target.checked ? "advanced" : "planning",
          ])
        }
      />
      <span>Advanced</span>
    </label>
  );
};
