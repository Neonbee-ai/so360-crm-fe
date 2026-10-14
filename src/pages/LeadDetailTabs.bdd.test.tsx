import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * BDD contract specs for the CRM Lead Detail tab navigation.
 * Tab overflow/scroll is now owned by Comb's DetailPageTemplate; the page only
 * supplies the ordered tab list (Overview first, Activity last).
 */
const src = readFileSync(path.resolve(__dirname, 'LeadDetailPage.tsx'), 'utf8');

describe('Lead Detail tabs - template contract', () => {
  it('Given the page, When rendering, Then tabs are delegated to DetailPageTemplate', () => {
    expect(src).toContain('<DetailPageTemplate');
    expect(src).toMatch(/tabs=\{detailTabs\}/);
    expect(src).toMatch(/onTabChange=/);
  });

  it('Given the tab list, Then Overview is first and Activity is last', () => {
    const start = src.indexOf('const detailTabs');
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, start + 900);
    expect(block.indexOf("'overview'")).toBeGreaterThan(-1);
    expect(block.indexOf("'overview'")).toBeLessThan(block.indexOf("'activity'"));
  });

  it('Given the page, Then hand-rolled tab strip and raw tab classes are gone', () => {
    expect(src).not.toContain('data-testid="detail-tab-strip"');
    expect(src).not.toContain('const tabCls');
  });
});
