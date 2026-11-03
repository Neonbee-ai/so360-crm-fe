/** Comb 1.1 motion constants — mirror --nb-dur-fast / --nb-dur / --nb-dur-slow in theme.css. */
export const NB_DUR_FAST = 120;
export const NB_DUR = 180;
export const NB_DUR_SLOW = 240;
/** Per-item delay for staggered lists/grids (--nb-stagger). */
export const NB_STAGGER = 40;
/** Only the first N items stagger; the rest appear with the last one. */
export const NB_STAGGER_MAX = 12;

/**
 * True when motion should run: a real browser without prefers-reduced-motion.
 * jsdom (unit tests) counts as "no motion" so closes stay synchronous in specs.
 */
export function motionAllowed(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;
    try {
        return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
        return true;
    }
}

/** Inline style that delays an item's enter animation by its index (capped at NB_STAGGER_MAX). */
export function staggerStyle(index: number): { animationDelay: string } {
    return { animationDelay: `calc(var(--nb-stagger, ${NB_STAGGER}ms) * ${Math.min(Math.max(index, 0), NB_STAGGER_MAX)})` };
}
