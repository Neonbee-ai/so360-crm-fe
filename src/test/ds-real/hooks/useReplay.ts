import { useEffect, useRef, useState } from 'react';
import { motionAllowed } from './motion';

export interface ReplayOptions {
    /** Only replay when this returns true for (next, previous). Default: any change. */
    when?: (next: unknown, prev: unknown) => boolean;
    /** Force on/off; default follows `motionAllowed()` (off under reduced motion / tests). */
    animate?: boolean;
}

/**
 * One-shot micro-feedback (shake, bump, flash): `active` turns true when `value`
 * changes after mount and back to false on `onAnimationEnd` of the animated node.
 */
export function useReplay(value: unknown, options: ReplayOptions = {}): { active: boolean; onAnimationEnd: (e?: { target: unknown; currentTarget: unknown }) => void } {
    const { when, animate } = options;
    const prev = useRef<unknown>(value);
    const [active, setActive] = useState(false);
    useEffect(() => {
        const before = prev.current;
        prev.current = value;
        if (Object.is(before, value)) return;
        if (!(animate ?? motionAllowed())) return;
        if (when && !when(value, before)) return;
        setActive(true);
    }, [value, when, animate]);
    return {
        active,
        // Ignore animationend bubbling up from children (spinners, staggered rows…).
        onAnimationEnd: (e) => {
            if (e && e.target !== e.currentTarget) return;
            setActive(false);
        },
    };
}

const isCount = (v: unknown): boolean => typeof v === 'number' || (typeof v === 'string' && /\d/.test(v));
/** Badge rule: bump when a numeric count changes. */
export const countChanged = (next: unknown, prev: unknown): boolean => isCount(next) && isCount(prev);
/** Field rule: shake when an error appears or changes to a new message. */
export const errorRaised = (next: unknown): boolean => Boolean(next);
