import type { NavigationType } from 'react-router-dom';

/**
 * Leads search auto-clear rule: a fresh visit (PUSH/REPLACE, e.g. sidebar or a
 * link) starts with an empty search box; Back from a lead or a reload (POP)
 * keeps it so the result list the user came from is still there. An explicit
 * `?q=` deep link always sets the search itself, so nothing is cleared.
 */
export function shouldClearLeadSearch(navigationType: NavigationType | `${NavigationType}`, locationSearch: string): boolean {
  if (new URLSearchParams(locationSearch).get('q')) return false;
  return navigationType !== 'POP';
}
