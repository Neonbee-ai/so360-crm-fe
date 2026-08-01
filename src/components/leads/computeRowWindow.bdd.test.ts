import { describe, it, expect } from 'vitest';
import { computeRowWindow } from './LeadsDataGrid';

// BDD specs for the grid's dependency-free windowing math.

describe('computeRowWindow', () => {
  describe('when virtualization is disabled', () => {
    it('renders all rows below the threshold', () => {
      const w = computeRowWindow(50, 56, 0, 800);
      expect(w).toEqual({ virtualize: false, startIndex: 0, endIndex: 50, topPad: 0, bottomPad: 0 });
    });

    it('renders all rows before the viewport is measured (height 0)', () => {
      const w = computeRowWindow(500, 56, 0, 0);
      expect(w.virtualize).toBe(false);
      expect(w.endIndex).toBe(500);
    });

    it('renders all rows when rowHeight is 0 (guards divide-by-zero)', () => {
      const w = computeRowWindow(500, 0, 100, 800);
      expect(w.virtualize).toBe(false);
    });
  });

  describe('when virtualization is active', () => {
    it('windows the first screen at scrollTop 0 with overscan clamped to 0', () => {
      const w = computeRowWindow(1000, 50, 0, 500, 8, 60);
      expect(w.virtualize).toBe(true);
      expect(w.startIndex).toBe(0); // max(0, 0 - 8)
      // ceil((0 + 500)/50) + 8 = 10 + 8 = 18
      expect(w.endIndex).toBe(18);
      expect(w.topPad).toBe(0);
      expect(w.bottomPad).toBe((1000 - 18) * 50);
    });

    it('windows a middle scroll position', () => {
      const w = computeRowWindow(1000, 50, 5000, 500, 8, 60);
      // floor(5000/50) - 8 = 100 - 8 = 92
      expect(w.startIndex).toBe(92);
      // ceil((5000+500)/50) + 8 = 110 + 8 = 118
      expect(w.endIndex).toBe(118);
      expect(w.topPad).toBe(92 * 50);
      expect(w.bottomPad).toBe((1000 - 118) * 50);
    });

    it('clamps endIndex to the total when scrolled to the bottom', () => {
      const w = computeRowWindow(200, 50, 100000, 500, 8, 60);
      expect(w.endIndex).toBe(200);
      expect(w.bottomPad).toBe(0);
    });

    it('preserves the invariant topPad + rendered + bottomPad == total height', () => {
      const total = 777;
      const rowH = 56;
      const w = computeRowWindow(total, rowH, 3000, 640, 8, 60);
      const rendered = (w.endIndex - w.startIndex) * rowH;
      expect(w.topPad + rendered + w.bottomPad).toBe(total * rowH);
    });
  });
});
