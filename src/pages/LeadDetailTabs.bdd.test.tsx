import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * BDD contract specs for the CRM Lead Detail "activity section" tab navigation.
 *
 * Bug: When the left navigation is expanded the available width shrinks, the
 * activity tabs (Activity / Notes / Tasks / Documents / Products / Feedback)
 * overflow their container and the last tab(s) get clipped with no way to reach
 * them — the row neither wraps nor scrolls.
 *
 * Fix: the tab row becomes a horizontally scrollable track (overflow-x-auto),
 * each tab refuses to shrink (shrink-0) and to wrap (whitespace-nowrap), and the
 * scrollbar is hidden visually (scrollbar-hide) while scroll stays functional.
 *
 * These are contract specs (same style as viteConfig.contract.spec.ts): they read
 * the real source so the guarantees can't silently regress via a className edit.
 */

const pageSource = readFileSync(
  path.resolve(__dirname, 'LeadDetailPage.tsx'),
  'utf8',
);
const globalCss = readFileSync(
  path.resolve(__dirname, '../index.css'),
  'utf8',
);

/** Isolate the activity-section tab-row container (the div that wraps the
 *  data-driven tab buttons, Task 5's layoutPrefs.visibleSections.map loop),
 *  independent of the higher-up Lead-Information tab row which is a
 *  different group. */
function activityTabRowClassName(): string {
  const marker = 'layoutPrefs.visibleSections.map(';
  const markerIdx = pageSource.indexOf(marker);
  expect(markerIdx).toBeGreaterThan(-1);
  // Walk backwards to the opening <div ...> that contains the activity button.
  const before = pageSource.slice(0, markerIdx);
  const divIdx = before.lastIndexOf('<div className="');
  expect(divIdx).toBeGreaterThan(-1);
  const open = pageSource.indexOf('"', divIdx + '<div className='.length);
  const close = pageSource.indexOf('"', open + 1);
  return pageSource.slice(open + 1, close);
}

/** Isolate the base (non-conditional) portion of the tabCls helper string. */
function tabClsBase(): string {
  const start = pageSource.indexOf('const tabCls = (tab: TabType) =>');
  expect(start).toBeGreaterThan(-1);
  const tickStart = pageSource.indexOf('`', start);
  const exprStart = pageSource.indexOf('${', tickStart);
  return pageSource.slice(tickStart + 1, exprStart);
}

describe('Lead Detail activity tab navigation — overflow contract', () => {
  describe('Given the activity-section tab row container', () => {
    const cls = activityTabRowClassName();

    it('When tabs overflow / Then the row is a horizontally scrollable track', () => {
      expect(cls).toContain('overflow-x-auto');
    });

    it('When scrolling / Then the scrollbar is hidden visually', () => {
      expect(cls).toContain('scrollbar-hide');
    });

    it('Then it never clips content with a hard overflow-hidden', () => {
      expect(cls).not.toContain('overflow-hidden');
    });

    it('Then the existing bottom-border styling is preserved', () => {
      expect(cls).toContain('border-b');
      expect(cls).toContain('border-slate-800');
      expect(cls).toContain('bg-slate-900/50');
    });
  });

  describe('Given each activity tab button (via tabCls)', () => {
    const base = tabClsBase();

    it('When the row is narrow / Then the tab refuses to shrink (no squeeze/clip)', () => {
      expect(base).toContain('shrink-0');
    });

    it('Then the tab label never wraps onto multiple lines', () => {
      expect(base).toContain('whitespace-nowrap');
    });

    it('Then the original spacing/padding is preserved', () => {
      expect(base).toContain('px-6');
      expect(base).toContain('py-4');
      expect(base).toContain('gap-2');
    });
  });

  describe('Given the active-tab styling', () => {
    it('Then the active indicator classes remain intact while scrolling', () => {
      expect(pageSource).toContain('border-b-2 border-blue-500 bg-blue-500/5');
      expect(pageSource).toContain('text-blue-400');
    });
  });
});

describe('scrollbar-hide utility — CSS contract', () => {
  describe('Given the global stylesheet', () => {
    it('When .scrollbar-hide is applied / Then Firefox/IE scrollbar chrome is removed', () => {
      expect(globalCss).toMatch(/\.scrollbar-hide\s*\{[^}]*scrollbar-width:\s*none/);
      expect(globalCss).toMatch(/\.scrollbar-hide\s*\{[^}]*-ms-overflow-style:\s*none/);
    });

    it('When .scrollbar-hide is applied / Then the WebKit scrollbar is hidden', () => {
      expect(globalCss).toMatch(
        /\.scrollbar-hide::-webkit-scrollbar\s*\{[^}]*display:\s*none/,
      );
    });

    it('Then hiding the bar does not disable scrolling (no overflow override)', () => {
      // The utility must only hide the scrollbar chrome; it must not set
      // overflow, which would break the functional horizontal scroll.
      const baseBlock = globalCss.match(/\.scrollbar-hide\s*\{([^}]*)\}/);
      expect(baseBlock).toBeTruthy();
      expect(baseBlock![1]).not.toMatch(/overflow\s*:/);
    });
  });
});
