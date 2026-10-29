import type { FilterGroup } from '../components/leads/leadFilterModel';

export interface FilterState {
  search: string;
  status: string;
  owner: string;
  creator: string;
  rating: string;
  dateRange: string;
  customDateStart: string;
  customDateEnd: string;
}

/** Sentinel owner-filter value for the Unassigned view (leads with no owner). */
export const UNASSIGNED_OWNER = '__unassigned__';

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'All',
  owner: 'All',
  creator: 'All',
  rating: 'All',
  dateRange: 'All',
  customDateStart: '',
  customDateEnd: '',
};

// ─── Server query builder ─────────────────────────────────────────────────────

const DATE_RANGE_PRESETS: Record<string, string> = {
  Today: 'today',
  Yesterday: 'yesterday',
  'This Week': 'this_week',
  'Last Week': 'last_week',
  'This Month': 'this_month',
  'Last Month': 'last_month',
};

/** Maps the page filter state (+ advanced tree) to GET /leads query params. */
export function buildLeadsQuery(f: FilterState, advanced: FilterGroup | null) {
  const q: Record<string, string> = {};
  const search = f.search.trim();
  if (search) q.q = search;
  if (f.status !== 'All') q.status = f.status;
  if (f.owner !== 'All' && f.owner !== UNASSIGNED_OWNER) q.owner_id = f.owner;
  if (f.creator !== 'All') q.created_by = f.creator;
  if (f.rating !== 'All') q.rating_id = f.rating;
  if (DATE_RANGE_PRESETS[f.dateRange]) {
    q.date_range = DATE_RANGE_PRESETS[f.dateRange];
  } else if (f.dateRange === 'Custom' && f.customDateStart && f.customDateEnd) {
    const end = new Date(f.customDateEnd);
    end.setHours(23, 59, 59, 999);
    q.date_range = 'custom';
    q.start_date = new Date(f.customDateStart).toISOString();
    q.end_date = end.toISOString();
  }
  // Unassigned has no plain query param: express it as an is_null rule, ANDed with any advanced tree.
  const rules: FilterGroup['rules'] = [];
  if (advanced) rules.push(advanced);
  if (f.owner === UNASSIGNED_OWNER) rules.push({ field: 'owner_id', op: 'is_null' });
  if (rules.length) q.filter = JSON.stringify(rules.length === 1 && advanced ? advanced : { combinator: 'and', rules });
  return q;
}

