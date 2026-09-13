import React, { useCallback, useMemo, useState } from 'react';
import { MAX_BULK_BUILDING_COUNT, sanitizeBuildingCount } from '@/features/bases/building-counts';

interface BuildingCountControlProps {
  value: number;
  ariaLabel: string;
  onChange: (nextValue: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
  cardLayout?: boolean;
}

export const BuildingCountControl: React.FC<BuildingCountControlProps> = ({
  value,
  ariaLabel,
  onChange,
  min = 0,
  max = MAX_BULK_BUILDING_COUNT,
  compact = false,
  cardLayout = false,
}) => {
  const [draftOverride, setDraftOverride] = useState<string | null>(null);
  const [pendingCommittedValue, setPendingCommittedValue] = useState<number | null>(null);
  const [previousValue, setPreviousValue] = useState(value);
  // Other cards can edit the same building type. Discard a draft when its source changes.
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraftOverride(null);
    setPendingCommittedValue(null);
  }

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

  const stepClass = cardLayout
    ? 'btn-sm h-8 min-h-8 p-0 font-normal text-base-content/65'
    : compact ? 'join-item btn-sm h-8 min-h-8 w-8 p-0 font-normal text-base-content/65' : 'join-item btn-xs';
  const inputClass = cardLayout
    ? 'input-sm h-8 w-full min-w-0 rounded-none px-0 text-xs text-base-content/80'
    : `join-item w-16 ${compact ? 'input-sm h-8 px-1 text-base-content/80' : 'input-xs'}`;
  const saveClass = cardLayout
    ? `btn-sm col-span-3 mt-1 h-8 min-h-8 ${canSave ? '' : 'hidden'}`
    : `join-item w-8 ${compact ? 'btn-sm h-8 min-h-8' : 'btn-xs'} ${canSave ? '' : 'invisible pointer-events-none'}`;

  return (
    <div className={cardLayout ? 'grid w-full min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] sm:grid-cols-[2rem_minmax(0,1fr)_2rem]' : 'join shrink-0'}>
      {!compact && !cardLayout && <div
        aria-hidden="true"
        className="join-item w-8 invisible pointer-events-none"
      />}
      <button
        type="button"
        className={`btn ${stepClass} ${cardLayout ? 'rounded-r-none' : ''}`}
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
        className={`input input-bordered text-center font-mono ${inputClass} ${hasInvalidDraft ? 'input-error' : ''}`}
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
        className={`btn ${stepClass} ${cardLayout ? 'rounded-l-none' : ''}`}
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
        className={`btn btn-primary px-0 ${saveClass}`}
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
