import React, { useState, useEffect } from 'react';
import { useTargetAmount } from '../hooks';

interface PlannerTargetInputProps {
    className?: string;
}

/**
 * Target amount input for the production planner
 */
export const PlannerTargetInput: React.FC<PlannerTargetInputProps> = ({ className = ''}) => {
    
    const { targetAmount, setTargetAmount } = useTargetAmount();
    const [inputValue, setInputValue] = useState<string>(targetAmount.toString());

    // Sync input value with subscription when targetAmount changes externally
    useEffect(() => {
        setInputValue(targetAmount === 0 ? '' : targetAmount.toString());
    }, [targetAmount]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value); // Update input instantly

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
                setInputValue(targetAmount.toString());
            } else {
                setInputValue('1');
                setTargetAmount(1);
            }
        } 
    };

    return (
        <div className="form-control flex flex-row items-center gap-1">
            <input
                type="number"
                min="1"
                step="1"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input input-bordered w-15 ${className}`}
            />
            <span className="text-sm text-base-content/70 whitespace-nowrap">/min</span>
        </div>
    );
};
