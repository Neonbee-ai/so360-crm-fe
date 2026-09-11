import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Sizes an element to fill from its own top edge down to the bottom of the
 * viewport, measured rather than assumed.
 *
 * A hardcoded `h-[calc(100vh-Npx)]` bakes in the height of the Shell chrome
 * (nav bar, banners, sidenav) above this MFE, which this component has no
 * visibility into and which changes per-tenant (subscription banners,
 * sandbox mode). Measuring the element's own top offset avoids depending on
 * that assumption entirely.
 */
export function useFillViewportHeight<T extends HTMLElement>(
    /** Used until the first measurement lands, and if the element never mounts. */
    fallback = '70vh',
    /** Floor, so a cramped or mis-measured viewport still leaves a usable board. */
    minPx = 420,
) {
    const ref = useRef<T>(null);
    const [height, setHeight] = useState<string>(fallback);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const measure = () => {
            const top = el.getBoundingClientRect().top;
            setHeight(`${Math.max(window.innerHeight - top, minPx)}px`);
        };

        measure();
        window.addEventListener('resize', measure);
        // Capture phase: the offset changes when any ancestor scrolls, not just
        // the window (the Shell scrolls its own frame, not the CRM MFE's own DOM).
        window.addEventListener('scroll', measure, true);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [minPx]);

    return { ref, height };
}
