import React, { useCallback, useMemo, useState } from 'react';
import { MAX_BULK_BUILDING_COUNT, sanitizeBuildingCount } from '../utils';

interface BuildingCountControlProps {
  value: number;
  ariaLabel: string;
  onChange: (nextValue: number) => void;
  min?: number;
  max?: number;
}

export const BuildingCountControl: React.FC<BuildingCountControlProps> = ({
  value,
  ariaLabel,
  onChange,
  min = 0,
  max = MAX_BULK_BUILDING_COUNT,
}) => {
  const [draftOverride, setDraftOverride] = useState<string | null>(null);
  const [pendingCommittedValue, setPendingCommittedValue] = useState<number | null>(null);

  const sanitizeValue = useCallback((nextValue: number) => {
    return Math.min(max, Math.max(min, sanitizeBuildingCount(nextValue)));
  }, [max, min]);

  const draftValue = pendingCommittedValue === value
    ? String(value)
    : (draftOverride ?? String(value));

  const parsedDraftValue = useMemo(() => {
    if (!/^\d+$/.test(draftValue)) return null;

    const numericValue = Number(draftValue);
    if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
      return null;
    }

    return numericValue;
  }, [draftValue, max, min]);

  const isValidDraft = parsedDraftValue !== null;
  const isDirty = isValidDraft ? parsedDraftValue !== value : draftValue !== String(value);
  const hasPendingCommit = isValidDraft && pendingCommittedValue === parsedDraftValue;
  const canSave = isValidDraft && parsedDraftValue !== value && !hasPendingCommit;
  const hasInvalidDraft = !isValidDraft && isDirty;
  const currentControlValue = parsedDraftValue ?? value;

  const adjustValue = useCallback((delta: number) => {
    const nextValue = sanitizeValue(currentControlValue + delta);
    setDraftOverride(String(nextValue));

    if (nextValue !== value) {
      setPendingCommittedValue(nextValue);
      onChange(nextValue);
    }
  }, [currentControlValue, onChange, sanitizeValue, value]);

  const commitDraftValue = useCallback(() => {
    if (parsedDraftValue === null) return;
    const sanitizedValue = sanitizeValue(parsedDraftValue);
    setDraftOverride(String(sanitizedValue));

    if (sanitizedValue !== value) {
      setPendingCommittedValue(sanitizedValue);
      onChange(sanitizedValue);
    }
  }, [onChange, parsedDraftValue, sanitizeValue, value]);

  return (
    <div className="join">
      <div
        aria-hidden="true"
        className="join-item w-8 invisible pointer-events-none"
      />
      <button
        type="button"
        className="btn btn-xs join-item"
        onClick={() => {
          adjustValue(-1);
        }}
        disabled={currentControlValue <= min}
        aria-label={`Decrease ${ariaLabel}`}
      >
        -
      </button>
      <input
        aria-label={ariaLabel}
        className={`input input-bordered input-xs join-item w-16 text-center font-mono ${hasInvalidDraft ? 'input-error' : ''}`}
        inputMode="numeric"
        value={draftValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (/^\d*$/.test(nextValue)) {
            setPendingCommittedValue(null);
            setDraftOverride(nextValue);
          }
        }}
        onBlur={() => {
          if (parsedDraftValue !== null) {
            setDraftOverride(parsedDraftValue === value ? null : String(parsedDraftValue));
          }
        }}
      />
      <button
        type="button"
        className="btn btn-xs join-item"
        onClick={() => {
          adjustValue(1);
        }}
        disabled={currentControlValue >= max}
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
      <button
        type="button"
        className={`btn btn-primary btn-xs join-item w-8 px-0 ${canSave ? '' : 'invisible pointer-events-none'}`}
        onClick={commitDraftValue}
        aria-label={`Save ${ariaLabel}`}
        tabIndex={canSave ? 0 : -1}
      >
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </button>
    </div>
  );
};
