import { appIds } from "@/app/uklad/catalog";
import React from "react";
import { useSubscription } from "@/app/uklad/bindings";
import {
  ModalHeader,
  InputsSelector,
  FormControls,
  DiagramSection,
} from "./components";

export const CreateProductionPlanModal: React.FC = () => {
  // Subscribe to modal open state
  const { isOpen } = useSubscription([
    appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-base-100">
      {/* Navigation and plan name */}
      <ModalHeader />

      {/* Select Inputs section */}
      <InputsSelector />

      {/* Controls section */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col flex-1 min-h-0"
      >
        <FormControls />

        {/* Diagram section - takes all remaining space */}
        <DiagramSection />
      </form>
    </div>
  );
};
