import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Keeps an absolutely positioned dropdown inside the viewport with an 8px gutter. */
export function useDropdownViewportPosition(open: boolean, anchor: RefObject<HTMLElement | null>) {
    const panelRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!open || !panel) return;

        const position = () => {
            // Measure the normal right-aligned position; mobile uses a fixed bottom sheet.
            panel.style.removeProperty('--dropdown-right');
            if (getComputedStyle(panel).position !== 'absolute') return;

            const bounds = panel.getBoundingClientRect();
            const viewportWidth = document.documentElement.clientWidth;
            const shift = Math.max(8 - bounds.left, Math.min(0, viewportWidth - 8 - bounds.right));
            panel.style.setProperty('--dropdown-right', `${-shift}px`);
        };

        position();
        const observer = new ResizeObserver(position);
        observer.observe(panel);
        if (anchor.current) observer.observe(anchor.current);
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
            window.removeEventListener('scroll', position, true);
            panel.style.removeProperty('--dropdown-right');
        };
    }, [open, anchor]);

    return panelRef;
}
