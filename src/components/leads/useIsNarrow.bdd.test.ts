import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isNarrowWidth, useIsNarrow, NARROW_BREAKPOINT } from './useIsNarrow';

const setWidth = (w: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });

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

describe('useIsNarrow (hook)', () => {
  afterEach(() => setWidth(1024));

  it('initialises from the current viewport width', () => {
    setWidth(500);
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(true);
  });

  it('is false on a wide viewport', () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(false);
  });

  it('updates when the window resizes across the breakpoint', () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(false);
    act(() => { setWidth(400); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe(true);
  });

  it('honours a custom breakpoint', () => {
    setWidth(700);
    const { result } = renderHook(() => useIsNarrow(640));
    expect(result.current).toBe(false);
  });

  it('removes its resize listener on unmount', () => {
    setWidth(1200);
    const { unmount, result } = renderHook(() => useIsNarrow());
    unmount();
    // After unmount a resize must not throw or affect the last value.
    act(() => { setWidth(300); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe(false);
  });
});
