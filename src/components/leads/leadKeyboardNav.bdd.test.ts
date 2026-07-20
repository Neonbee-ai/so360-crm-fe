import { describe, it, expect } from 'vitest';
import { nextFocusIndex, scrollToRevealIndex, NAV_KEYS } from './leadKeyboardNav';

describe('nextFocusIndex', () => {
  it('ignores non-navigation keys', () => {
    expect(nextFocusIndex(0, 'Enter', 10)).toBeNull();
    expect(nextFocusIndex(0, 'a', 10)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(nextFocusIndex(-1, 'ArrowDown', 0)).toBeNull();
  });

  it('lands on the first row from "no focus"', () => {
    expect(nextFocusIndex(-1, 'ArrowDown', 5)).toBe(0);
    expect(nextFocusIndex(-1, 'ArrowUp', 5)).toBe(0);
    expect(nextFocusIndex(-1, 'Home', 5)).toBe(0);
  });

  it('moves down and clamps at the last row', () => {
    expect(nextFocusIndex(0, 'ArrowDown', 3)).toBe(1);
    expect(nextFocusIndex(2, 'ArrowDown', 3)).toBe(2);
  });

  it('moves up and clamps at the first row', () => {
    expect(nextFocusIndex(2, 'ArrowUp', 3)).toBe(1);
    expect(nextFocusIndex(0, 'ArrowUp', 3)).toBe(0);
  });

  it('jumps to first/last with Home/End', () => {
    expect(nextFocusIndex(4, 'Home', 6)).toBe(0);
    expect(nextFocusIndex(1, 'End', 6)).toBe(5);
  });

  it('NAV_KEYS enumerates the handled keys', () => {
    expect([...NAV_KEYS].sort()).toEqual(['ArrowDown', 'ArrowUp', 'End', 'Home']);
  });
});

describe('scrollToRevealIndex', () => {
  const H = 56;
  const VH = 560; // 10 rows tall

  it('keeps the current scroll when the row is already visible', () => {
    expect(scrollToRevealIndex(3, H, 0, VH)).toBe(0);
  });

  it('scrolls up so a row above the viewport comes into view', () => {
    // scrolled to row 5's top; focusing row 2 pulls up to row 2's top
    expect(scrollToRevealIndex(2, H, 5 * H, VH)).toBe(2 * H);
  });

  it('scrolls down so a row below the viewport sits at the bottom edge', () => {
    // viewport shows rows 0..9; focusing row 12 → bottom edge alignment
    const expected = 13 * H - VH;
    expect(scrollToRevealIndex(12, H, 0, VH)).toBe(expected);
  });

  it('is a no-op for invalid inputs', () => {
    expect(scrollToRevealIndex(-1, H, 100, VH)).toBe(100);
    expect(scrollToRevealIndex(2, 0, 100, VH)).toBe(100);
    expect(scrollToRevealIndex(2, H, 100, 0)).toBe(100);
  });
});
