interface ConnectionPickerButtonProps {
    label: string;
    value: string;
    title: string;
    expanded: boolean;
    onClick: () => void;
}

export function ConnectionPickerButton({ label, value, title, expanded, onClick }: ConnectionPickerButtonProps) {
    return <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={expanded}
        title={title} onClick={onClick}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-base-300 bg-base-200/55 px-2.5 text-left text-xs font-normal text-base-content/70 shadow-inner shadow-base-300/20 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <svg className="h-3.5 w-3.5 shrink-0 text-base-content/45" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 5.5 12 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </button>;
}
