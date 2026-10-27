/**
 * Minimal GET helper used by the self-fetching selector components
 * (DepartmentSelector, PeopleSelector, UserSelector, LeaveCalendar).
 *
 * Uses the native `fetch` API instead of `axios` on purpose: this package is
 * bundled from source into every consuming MFE, and pulling a runtime
 * dependency (axios) into that build graph breaks the MFEs' Vite/Rollup
 * production builds when the dependency is not resolvable in the consumer.
 * `fetch` is always available, so there is nothing for Rollup to resolve.
 *
 * Returns the parsed JSON body, i.e. the equivalent of axios's `response.data`.
 */
export interface HttpGetOptions {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export async function httpGetJson(url: string, options: HttpGetOptions = {}): Promise<any> {
  const { params, headers } = options;

  let finalUrl = url;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        qs.append(key, String(value));
      }
    });
    const query = qs.toString();
    if (query) {
      finalUrl += (url.includes('?') ? '&' : '?') + query;
    }
  }

  const response = await fetch(finalUrl, { headers });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }
  return response.json();
}
