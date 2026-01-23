import React from 'react';

interface PlannerTargetInputProps {
    targetAmount: number;
    onTargetAmountChange: (amount: number) => void;
    className?: string;
    label?: string;
    showLabel?: boolean;
}

/**
 * Target amount input for the production planner
 */
export const PlannerTargetInput: React.FC<PlannerTargetInputProps> = ({
    targetAmount,
    onTargetAmountChange,
    className = '',
    label = 'Target (per min):',
    showLabel = true
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            onTargetAmountChange(0);
        } else {
            const numValue = Number(value);
            if (numValue >= 1) {
                onTargetAmountChange(numValue);
            }
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        if (value < 1 || isNaN(value)) {
            onTargetAmountChange(1);
        }
    };

    return (
        <div className="form-control">
            {showLabel && (
                <label className="label pb-1">
                    <span className="label-text font-semibold text-sm lg:text-base">{label}</span>
                </label>
            )}
            <input
                type="number"
                min="1"
                step="1"
                value={targetAmount === 0 ? '' : targetAmount}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input input-bordered ${className}`}
            />
        </div>
    );
};
