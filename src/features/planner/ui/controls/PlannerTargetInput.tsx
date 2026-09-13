import React, { useState } from 'react';
import { useTargetAmount } from '../hooks';

interface PlannerTargetInputProps {
    className?: string;
}

/**
 * Target amount input for the production planner
 */
export const PlannerTargetInput: React.FC<PlannerTargetInputProps> = ({ className }) => {
    const { targetAmount, setTargetAmount } = useTargetAmount();
    return <TargetAmountInput targetAmount={targetAmount} setTargetAmount={setTargetAmount} className={className} />;
};

interface TargetAmountInputProps extends PlannerTargetInputProps {
    targetAmount: number;
    setTargetAmount: (amount: number) => void;
    disabled?: boolean;
}

export const TargetAmountInput: React.FC<TargetAmountInputProps> = ({ targetAmount, setTargetAmount, disabled, className = '' }) => {
    const [inputValueDraft, setInputValueDraft] = useState<string | null>(null);
    const inputValue = (!disabled ? inputValueDraft : null) ?? (targetAmount === 0 ? '' : targetAmount.toString());

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValueDraft(value); // Update input instantly

        if (value === '') {
            setTargetAmount(0);
        } else {
            const numValue = Number(value);
            if (numValue >= 1) {
                setTargetAmount(numValue);
            }
        }
    };

    const handleBlur = () => {
        const value = Number(inputValue);
        if (value < 1 || isNaN(value)) {
            if (targetAmount >= 1 && !isNaN(targetAmount)) {
                // Ensure input reflects the valid targetAmount
                setInputValueDraft(null);
            } else {
                setInputValueDraft('1');
                setTargetAmount(1);
            }
        } else {
            setInputValueDraft(null);
        }
    };

    return (
        <div className="form-control flex flex-row items-center gap-1">
            <input
                type="number"
                aria-label="Target items per minute"
                min="1"
                step="1"
                disabled={disabled}
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input input-bordered w-15 ${className}`}
            />
            <span className="text-sm text-base-content/70 whitespace-nowrap">/min</span>
        </div>
    );
};
