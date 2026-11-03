import { useEffect, useRef, useState } from 'react';
import { motionAllowed, NB_DUR } from './motion';

export type PresenceState = 'open' | 'closing' | 'closed';

export interface PresenceOptions {
    /** Exit animation length in ms (default --nb-dur, 180ms). */
    exitMs?: number;
    /** Force motion on/off; defaults to motionAllowed() (off under reduced motion and in jsdom). */
    animate?: boolean;
}

export interface Presence {
    /** Render the element while true (stays true during the exit animation). */
    mounted: boolean;
    /** 'open' while shown, 'closing' while the exit animation runs, 'closed' once unmounted. */
    state: PresenceState;
    /** Call from onAnimationEnd to unmount as soon as the exit animation finishes. */
    onExitEnd: () => void;
}

/**
 * Keeps an overlay mounted while its exit animation plays, then unmounts it.
 * Unmount happens on onExitEnd or after exitMs (+40ms safety), whichever is first.
 */
export function usePresence(open: boolean, options: PresenceOptions = {}): Presence {
    const { exitMs = NB_DUR, animate } = options;
    const [state, setState] = useState<PresenceState>(open ? 'open' : 'closed');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wasOpen = useRef(open);

    const clear = () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    };

    useEffect(() => {
        const prev = wasOpen.current;
        wasOpen.current = open;
        if (open) {
            clear();
            setState('open');
            return undefined;
        }
        if (!prev) return undefined;
        const run = animate ?? motionAllowed();
        if (!run || exitMs <= 0) {
            setState('closed');
            return undefined;
        }
        setState('closing');
        clear();
        timer.current = setTimeout(() => {
            timer.current = null;
            setState('closed');
        }, exitMs + 40);
        return clear;
    }, [open, exitMs, animate]);

    useEffect(() => clear, []);

    const onExitEnd = () => {
        if (wasOpen.current) return;
        clear();
        setState('closed');
    };

    // While `open` just flipped false but the effect hasn't run yet, keep rendering (no flash of unmount).
    const effective: PresenceState = open ? 'open' : state === 'open' ? 'closing' : state;
    const run = animate ?? motionAllowed();
    const finalState: PresenceState = !open && !run && effective === 'closing' ? 'closed' : effective;
    return { mounted: finalState !== 'closed', state: finalState, onExitEnd };
}
