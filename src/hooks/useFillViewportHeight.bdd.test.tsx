import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import React from 'react';
import { useFillViewportHeight } from './useFillViewportHeight';

const setInnerHeight = (h: number) =>
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });

// getBoundingClientRect is unimplemented in jsdom — every probe element in a
// given test reads from this shared, mutable "top" so a test can move the
// element (simulating the Shell chrome above it growing/shrinking) and
// re-trigger a measurement without needing a new component instance.
let stubbedTop = 0;
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

function Probe({ fallback, minPx }: { fallback?: string; minPx?: number }) {
  const { ref, height } = useFillViewportHeight<HTMLDivElement>(fallback, minPx);
  return <div ref={ref} data-testid="probe" data-height={height} />;
}

const renderProbe = (fallback?: string, minPx?: number) => {
  render(<Probe fallback={fallback} minPx={minPx} />);
  return () => screen.getByTestId('probe').getAttribute('data-height');
};

afterEach(() => {
  setInnerHeight(768);
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  stubbedTop = 0;
});

describe('useFillViewportHeight — Given the hook has not measured anything yet', () => {
  it('When rendered outside any DOM tree / Then returns the fallback height', () => {
    const { result } = renderHook(() => useFillViewportHeight());
    expect(result.current.height).toBe('70vh');
  });

  it('When rendered with a custom fallback outside any DOM tree / Then returns that fallback', () => {
    const { result } = renderHook(() => useFillViewportHeight('55vh'));
    expect(result.current.height).toBe('55vh');
  });
});

describe('useFillViewportHeight — Given the ref is attached to a mounted element', () => {
  it('When the element sits below the Shell chrome / Then the height fills from the element top to the viewport bottom', () => {
    setInnerHeight(1000);
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 250, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };

    const getHeight = renderProbe();
    expect(getHeight()).toBe('750px');
  });

  it('When the computed height would fall below the floor / Then clamps to the default 420px floor', () => {
    setInnerHeight(400);
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 350, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect; // 400 - 350 = 50px
    };

    const getHeight = renderProbe();
    expect(getHeight()).toBe('420px');
  });

  it('When a custom minPx floor is given / Then clamps to that floor instead of the default', () => {
    setInnerHeight(400);
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 350, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };

    const getHeight = renderProbe('70vh', 200);
    expect(getHeight()).toBe('200px');
  });
});

describe('useFillViewportHeight — Given the viewport is resized after mount', () => {
  it('When the window resize event fires / Then re-measures and updates the height', () => {
    setInnerHeight(900);
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: stubbedTop, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };
    stubbedTop = 100;

    const getHeight = renderProbe();
    expect(getHeight()).toBe('800px');

    setInnerHeight(600);
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(getHeight()).toBe('500px');
  });

  it('When a scroll event fires on an ancestor (capture phase) / Then re-measures the height', () => {
    setInnerHeight(900);
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: stubbedTop, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };
    stubbedTop = 100;

    const getHeight = renderProbe();
    expect(getHeight()).toBe('800px');

    stubbedTop = 300;
    act(() => { document.body.dispatchEvent(new Event('scroll')); });
    expect(getHeight()).toBe('600px');
  });
});

describe('useFillViewportHeight — Given the component unmounts', () => {
  it('When unmounted / Then removes its resize and scroll listeners without throwing', () => {
    setInnerHeight(900);
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 100, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };

    const { unmount } = render(<Probe />);
    unmount();

    expect(() => {
      setInnerHeight(400);
      act(() => { window.dispatchEvent(new Event('resize')); });
    }).not.toThrow();
  });
});
