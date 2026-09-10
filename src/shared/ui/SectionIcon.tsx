const iconPaths = {
    bases: (
        <>
            <path d="m3 10 9-7 9 7M5 8.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
            <path d="M9 21v-8h6v8M9 17h6" />
        </>
    ),
    items: (
        <>
            <path d="m13 3 7 4a2 2 0 0 1 1 1.7v6.6a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4a2 2 0 0 1-1-1.7V8.7A2 2 0 0 1 4 7l7-4a2 2 0 0 1 2 0Z" />
            <path d="m3.4 7.8 8.6 5 8.6-5M12 13v8.3M7.5 5 16 10" />
        </>
    ),
    buildings: (
        <>
            <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M17 10h2a1 1 0 0 1 1 1v10M3 21h18" />
            <path d="M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1M9 21v-3h3v3" />
        </>
    ),
    corporations: (
        <>
            <rect x="3" y="7" width="18" height="14" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12l9 3 9-3M12 13v4" />
        </>
    ),
    planner: (
        <>
            <rect x="3" y="9" width="6" height="6" rx="1" />
            <rect x="15" y="3" width="6" height="6" rx="1" />
            <rect x="15" y="15" width="6" height="6" rx="1" />
            <path d="M9 12h3M15 6h-2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2" />
        </>
    ),
};

export type SectionIconName = keyof typeof iconPaths;

interface SectionIconProps {
    name: SectionIconName;
    className?: string;
}

/** Shared decorative icons for navigation and planner statistics. */
export const SectionIcon = ({ name, className = 'h-5 w-5' }: SectionIconProps) => (
    <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className={`shrink-0 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {iconPaths[name]}
    </svg>
);
