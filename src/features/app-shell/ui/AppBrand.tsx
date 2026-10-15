import { Link } from 'react-router-dom';

/** The landing page's two-line wordmark, sized for the tool header. */
export function AppBrand({ homePath, compact = false }: { homePath: string; compact?: boolean }) {
    return <Link to={homePath} aria-label="Rupture Planner"
        className={`flex shrink-0 items-center rounded font-['Segoe_UI',Arial,sans-serif] focus-visible:outline-2 focus-visible:outline-primary ${compact ? 'gap-[9px]' : 'gap-[13px]'}`}>
        <img src="/logo_black_bg.webp" alt="" width={compact ? 35 : 42} height={compact ? 35 : 42}
            className="shrink-0 rounded border border-[#3d4547]" loading="eager" decoding="async" fetchPriority="high" />
        <span aria-hidden="true" className={`inline-grid font-extrabold leading-[1.2] ${compact ? 'text-[13px]' : 'text-base'}`}>
            <span className="-mr-[.075em] tracking-[.075em]">RUPTURE</span>
            <span className={`flex justify-between font-medium text-base-content/65 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
                {'PLANNER'.split('').map((letter, index) => <span key={index}>{letter}</span>)}
            </span>
        </span>
    </Link>;
}
