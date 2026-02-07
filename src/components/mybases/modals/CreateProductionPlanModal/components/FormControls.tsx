import React, { useState, useCallback, useRef } from 'react';
import { useSubscription, dispatch } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../../../state/sub-ids';
import { EVENT_IDS } from '../../../../../state/event-ids';
import type { Item } from '../../../../../state/db';
import { CorporationLevelSelector, type SelectedCorporationLevel } from '../../../../ui/CorporationLevelSelector';
import type { CorporationLevelInfo } from '../../../../planner';
import { useDebouncedCallback } from '../../../../../hooks/useDebouncedCallback';

const DEBOUNCE_DELAY = 300;

interface FormControlsInitialValues {
    defaultName: string;
    defaultSelectedCorporationLevel: SelectedCorporationLevel | null;
    currentSelectedItemId: string;
    currentTargetAmount: number;
    selectedItemName: string;
}

interface TargetAmountInputProps {
    currentTargetAmount: number;
}

const TargetAmountInput: React.FC<TargetAmountInputProps> = ({ currentTargetAmount }) => {
    const [localTargetAmountInput, setLocalTargetAmountInput] = useState(() => currentTargetAmount.toString());

    const debouncedSetTargetAmount = useDebouncedCallback(
        (amount: number) => dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, amount]),
        DEBOUNCE_DELAY
    );

    const handleTargetAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalTargetAmountInput(value);

        const numValue = Number(value);
        if (!isNaN(numValue) && numValue >= 1) {
            debouncedSetTargetAmount(numValue);
        }
    }, [debouncedSetTargetAmount]);

    const handleTargetAmountBlur = useCallback(() => {
        setLocalTargetAmountInput(currentTargetAmount.toString());
    }, [currentTargetAmount]);

    return (
        <input
            type="number"
            className="input input-bordered input-sm w-20"
            value={localTargetAmountInput}
            onChange={handleTargetAmountChange}
            onBlur={handleTargetAmountBlur}
            min={1}
            required
        />
    );
};

export const FormControls: React.FC = () => {
    const initialValues = useSubscription<FormControlsInitialValues>([SUB_IDS.PRODUCTION_PLAN_MODAL_FORM_VALUES]);
    const selectableItems = useSubscription<Item[]>([SUB_IDS.PLANNER_SELECTABLE_ITEMS]);
    const corporationLevels = useSubscription<CorporationLevelInfo[]>([SUB_IDS.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS]);

    const {
        defaultName,
        currentSelectedItemId,
        defaultSelectedCorporationLevel,
        currentTargetAmount,
        selectedItemName,
    } = initialValues;

    // Track initial defaultName to check if it was empty when modal opened
    const initialDefaultNameRef = useRef<string>(defaultName);
    // Track if user manually changed the name
    const [userChangedName, setUserChangedName] = useState(false);

    // Local state for form fields - initialized once from defaults
    const [localName, setLocalName] = useState(defaultName);
    const [localCorporationLevel, setLocalCorporationLevel] = useState(defaultSelectedCorporationLevel);

    // Debounced event dispatchers
    const debouncedSetName = useDebouncedCallback(
        (value: string) => dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_NAME, value]),
        DEBOUNCE_DELAY
    );

    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalName(value);
        setUserChangedName(true);
        debouncedSetName(value);
    }, [debouncedSetName]);

    const handleItemSelect = useCallback((itemId: string) => {
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, itemId]);

        // If defaultName was empty and user didn't manually change the name, set name to "${itemName} Production"
        const initialDefaultName = initialDefaultNameRef.current;
        if (!initialDefaultName && !userChangedName && itemId) {
            const selectedItem = selectableItems.find(item => item.id === itemId);
            if (selectedItem) {
                const newName = `${selectedItem.name} Production`;
                setLocalName(newName);
                debouncedSetName(newName);
            }
        }
    }, [userChangedName, selectableItems, debouncedSetName]);

    const handleCorporationLevelChange = useCallback((level: SelectedCorporationLevel | null) => {
        setLocalCorporationLevel(level);
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, level]);
    }, []);

    return (
        <div className="px-4 py-2 border-b border-base-300 flex-shrink-0">
            <div className="flex flex-wrap items-center gap-3">
                {/* Plan Name */}
                <div className="form-control flex-1 min-w-[200px]">
                    <input
                        type="text"
                        className="input input-bordered input-sm w-full"
                        value={localName}
                        onChange={handleNameChange}
                        placeholder={selectedItemName ? `${selectedItemName} Production` : 'Enter plan name'}
                        required
                    />
                </div>

                {/* Item Selector */}
                <div className="form-control flex-1 min-w-[200px]">
                    <select
                        className="select select-bordered select-sm w-full"
                        value={currentSelectedItemId}
                        onChange={(e) => handleItemSelect(e.target.value)}
                        required
                    >
                        <option value="">Choose an item to produce</option>
                        {selectableItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Target Amount */}
                <div className="form-control flex items-center gap-2 min-w-[120px]">
                    <TargetAmountInput
                        //key is needed to reset component with currentTargetAmount when currentSelectedItemId has changed
                        key={currentSelectedItemId || 'no-item-selected'}
                        currentTargetAmount={currentTargetAmount}
                    />
                    <span className="text-xs text-base-content/70 whitespace-nowrap">/min</span>
                </div>

                {/* Corporation Level Selector */}
                <CorporationLevelSelector
                    corporationLevels={corporationLevels}
                    selectedLevel={localCorporationLevel}
                    onChange={handleCorporationLevelChange}
                    targetAmount={currentTargetAmount}
                    className="min-w-[200px]"
                />
            </div>
        </div>
    );
};
