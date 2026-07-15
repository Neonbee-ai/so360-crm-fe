import { describe, it, expect } from 'vitest';
import { isNarrowWidth, NARROW_BREAKPOINT } from './useIsNarrow';

describe('isNarrowWidth', () => {
  it('is narrow below the breakpoint', () => {
    expect(isNarrowWidth(500)).toBe(true);
    expect(isNarrowWidth(NARROW_BREAKPOINT - 1)).toBe(true);
  });

  it('is not narrow at or above the breakpoint', () => {
    expect(isNarrowWidth(NARROW_BREAKPOINT)).toBe(false);
    expect(isNarrowWidth(1200)).toBe(false);
  });

  it('honours a custom breakpoint', () => {
    expect(isNarrowWidth(700, 640)).toBe(false);
    expect(isNarrowWidth(600, 640)).toBe(true);
  });
});
