import { describe, it, expect } from 'vitest';
import { shouldClearLeadSearch } from './leadSearchReset';

describe('Given the Leads search auto-clear rule', () => {
  it('When the user opens Leads from the sidebar (PUSH) / Then the search is cleared', () => {
    expect(shouldClearLeadSearch('PUSH', '')).toBe(true);
  });

  it('When Leads is entered via a replace navigation / Then the search is cleared', () => {
    expect(shouldClearLeadSearch('REPLACE', '')).toBe(true);
  });

  it('When the user comes Back from a lead (POP) / Then the search is kept', () => {
    expect(shouldClearLeadSearch('POP', '')).toBe(false);
  });

  it('When a ?q= deep link opens Leads / Then nothing is cleared (q sets the search)', () => {
    expect(shouldClearLeadSearch('PUSH', '?q=acme')).toBe(false);
  });
});
