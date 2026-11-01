import { describe, it, expect } from 'vitest';
import { buildLeadsQuery, DEFAULT_FILTERS, UNASSIGNED_OWNER } from './leadsListQuery';

describe('buildLeadsQuery', () => {
  it('Given default filters / When built / Then no server params are sent', () => {
    expect(buildLeadsQuery(DEFAULT_FILTERS, null)).toEqual({});
  });

  it('Given search, status, owner, creator and rating / When built / Then each maps to its server param', () => {
    const q = buildLeadsQuery(
      { ...DEFAULT_FILTERS, search: '  acme ', status: 'New', owner: 'u1', creator: 'u2', rating: 'r1' },
      null,
    );
    expect(q).toEqual({ q: 'acme', status: 'New', owner_id: 'u1', created_by: 'u2', rating_id: 'r1' });
  });

  it('Given a preset date range / When built / Then date_range is the server preset key', () => {
    expect(buildLeadsQuery({ ...DEFAULT_FILTERS, dateRange: 'This Week' }, null)).toEqual({ date_range: 'this_week' });
  });

  it('Given a custom range / When built / Then start and end are ISO and end is end-of-day', () => {
    const q = buildLeadsQuery(
      { ...DEFAULT_FILTERS, dateRange: 'Custom', customDateStart: '2025-01-01', customDateEnd: '2025-01-31' },
      null,
    );
    expect(q.date_range).toBe('custom');
    expect(new Date(q.end_date).getHours()).toBe(23);
    expect(q.start_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('Given a custom range missing an end / When built / Then no date params are sent', () => {
    expect(buildLeadsQuery({ ...DEFAULT_FILTERS, dateRange: 'Custom', customDateStart: '2025-01-01' }, null)).toEqual({});
  });

  it('Given Unassigned scope / When built / Then it becomes an is_null owner rule and no owner_id', () => {
    const q = buildLeadsQuery({ ...DEFAULT_FILTERS, owner: UNASSIGNED_OWNER }, null);
    expect(q.owner_id).toBeUndefined();
    expect(JSON.parse(q.filter)).toEqual({ combinator: 'and', rules: [{ field: 'owner_id', op: 'is_null' }] });
  });

  it('Given an advanced tree only / When built / Then the tree is sent unchanged', () => {
    const tree: any = { combinator: 'or', rules: [{ field: 'company_name', op: 'contains', value: 'x' }] };
    expect(JSON.parse(buildLeadsQuery(DEFAULT_FILTERS, tree).filter)).toEqual(tree);
  });

  it('Given an advanced tree and Unassigned / When built / Then both are ANDed', () => {
    const tree: any = { combinator: 'or', rules: [{ field: 'company_name', op: 'contains', value: 'x' }] };
    const f = JSON.parse(buildLeadsQuery({ ...DEFAULT_FILTERS, owner: UNASSIGNED_OWNER }, tree).filter);
    expect(f.combinator).toBe('and');
    expect(f.rules).toHaveLength(2);
  });
});
