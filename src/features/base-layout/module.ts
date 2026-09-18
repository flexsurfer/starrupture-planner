import type { UkladModule, UkladRegistrar } from "@ukladjs/core/vanilla";
import type { AppContracts } from "@/app/uklad/contracts";
import { registerBaseLayoutEvents } from "./events";
import { registerBaseLayoutSubscriptions } from "./subscriptions";

export const registerBaseLayoutModule: UkladModule<
  UkladRegistrar<AppContracts>
> = (registrar) => {
  registerBaseLayoutEvents(registrar);
  registerBaseLayoutSubscriptions(registrar);
};
