/**
 * useIsNarrow — viewport width hook for the leads grid's responsive switch.
 *
 * Below the breakpoint the grid renders a tap-friendly card list instead of the
 * dense desktop table. The comparison is a pure, testable function; the hook is
 * a thin resize-listening wrapper around it.
 */
import { useState, useEffect } from 'react';

/** Default breakpoint (Tailwind `md`). Below this we treat the viewport as narrow. */
export const NARROW_BREAKPOINT = 768;

export function isNarrowWidth(width: number, breakpoint: number = NARROW_BREAKPOINT): boolean {
  return width < breakpoint;
}

export function useIsNarrow(breakpoint: number = NARROW_BREAKPOINT): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && isNarrowWidth(window.innerWidth, breakpoint),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setNarrow(isNarrowWidth(window.innerWidth, breakpoint));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return narrow;
}
