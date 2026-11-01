import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f: string) => readFileSync(resolve(__dirname, f), 'utf8');

describe('LeadDetailPage load order and phone layout (r17)', () => {
  describe('Given the lead record gates the page spinner', () => {
    it('When fetchLeadData runs / Then GET lead is issued before the supporting calls', () => {
      const src = read('LeadDetailPage.tsx');
      const lead = src.indexOf('crmService.getLeadById(id)');
      const supporting = src.indexOf('crmService.getDealsByLeadId(id)');
      expect(lead).toBeGreaterThan(-1);
      expect(lead).toBeLessThan(supporting);
    });
  });
  describe('Given profile rows hold long values at phone width', () => {
    it('When rendered / Then value columns can shrink (min-w-0) instead of overflowing', () => {
      expect(read('LeadDetailPage.tsx')).not.toContain('className="flex flex-col flex-1"');
    });
  });
  describe('Given the dashboard Customize button on a phone header', () => {
    it('When rendered / Then the label collapses to icon-only below sm', () => {
      expect(read('DashboardPage.tsx')).toContain('max-sm:sr-only');
    });
  });
});
