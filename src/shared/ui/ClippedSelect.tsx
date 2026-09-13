import React from 'react';

interface ClippedSelectProps {
  value: string;
  displayValue: string;
  title: string;
  ariaLabel?: string;
  size?: 'xs' | 'sm';
  tone?: 'default' | 'muted';
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}

/**
 * A native <select> rendered invisibly over a styled, truncating display box.
 * Keeps the chrome consistent with the rest of the UI while the browser still
 * owns the dropdown behaviour and accessibility.
 */
export const ClippedSelect: React.FC<ClippedSelectProps> = ({
  value,
  displayValue,
  title,
  ariaLabel,
  size = 'xs',
  tone = 'default',
  onChange,
  children,
}) => {
  const heightClass = size === 'sm' ? 'h-8' : 'h-7';
  const textClass = size === 'sm' ? 'text-sm' : 'text-xs';
  const emphasisClass = tone === 'muted'
    ? 'text-xs font-normal text-base-content/70'
    : `${textClass} font-medium text-base-content/90`;

  return (
    <div className="relative min-w-0 w-0 max-w-full flex-1">
      <select
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        value={value}
        onChange={onChange}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </select>
      <div
        className={`pointer-events-none flex ${heightClass} w-full items-center rounded-md border border-base-300 bg-base-200/55 px-2.5 pr-7 ${emphasisClass} shadow-inner shadow-base-300/20 transition-colors peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20`}
      >
        <span className="block max-w-full truncate">
          {displayValue}
        </span>
      </div>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/45"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5.5 7.5 10 12l4.5-4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
