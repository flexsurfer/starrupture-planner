import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { CorporationLevelSelector } from '@/features/corporations/ui';
import { ItemSelector } from '@/features/planner/ui/controls/PlannerItemSelector';
import { TargetAmountInput } from '@/features/planner/ui/controls/PlannerTargetInput';
import { RecipeAlternativesSelector } from './RecipeAlternativesSelector';

export const FormControls: React.FC = () => {
    const runtime = useRuntime();
    const { currentSelectedItemId, currentTargetAmount, defaultSelectedCorporationLevel, matchInputs } =
        useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES]);
    const selectableItems = useSubscription([appIds.subscriptions.PLANNER_SELECTABLE_ITEMS]);
    const corporationLevels = useSubscription([appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS]);

    return (
        <div className="px-4 py-2 border-b border-base-300 shrink-0 bg-base-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:gap-x-6">
                <div className="flex min-w-0 w-full items-center gap-2 sm:w-auto sm:gap-4">
                    <ItemSelector
                        selectedItemId={currentSelectedItemId}
                        items={selectableItems}
                        onSelect={(itemId) => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, itemId])}
                        className="select-sm w-0 min-w-0 flex-1 sm:w-50 sm:flex-none text-xs sm:text-sm"
                    />
                    <TargetAmountInput
                        key={`${currentSelectedItemId}-${matchInputs}`}
                        targetAmount={currentTargetAmount}
                        setTargetAmount={(amount) => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, amount])}
                        disabled={matchInputs}
                        className="input-sm text-xs sm:text-sm"
                    />
                </div>
                <label className="label cursor-pointer gap-2 px-0">
                    <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={matchInputs}
                        onChange={(event) => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, event.target.checked])}
                    />
                    <span className="text-xs whitespace-nowrap">Match inputs</span>
                </label>
                <CorporationLevelSelector
                    corporationLevels={corporationLevels}
                    selectedLevel={defaultSelectedCorporationLevel}
                    onChange={(level) => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, level])}
                    targetAmount={currentTargetAmount}
                    className="max-w-full sm:max-w-md"
                />
                <RecipeAlternativesSelector />
            </div>
        </div>
    );
};
