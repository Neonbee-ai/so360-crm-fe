import { describe, it, expect } from 'vitest';
import { groupLeadsBy, GROUP_BY_OPTIONS, type GroupByKey } from './leadGrouping';
import type { Lead } from '../../types/crm';

const NOW = Date.parse('2026-07-10T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const lead = (over: Partial<Lead> = {}): Lead =>
  ({ id: Math.random().toString(36).slice(2), company_name: 'X', created_at: daysAgo(1), activities: [], ...(over as object) } as Lead);

const owner = (id: string, name: string) => ({ id, full_name: name, email: `${id}@t.com` });

describe('GROUP_BY_OPTIONS', () => {
  it('offers none + the grouping dimensions', () => {
    expect(GROUP_BY_OPTIONS.map((o) => o.key)).toEqual(
      expect.arrayContaining<GroupByKey>(['none', 'status', 'owner', 'source', 'priority', 'lead_health']),
    );
  });
});

describe('groupLeadsBy none', () => {
  it('returns a single synthetic group holding every lead', () => {
    const leads = [lead(), lead(), lead()];
    const groups = groupLeadsBy(leads, 'none');
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].leads).toBe(leads);
  });
});

describe('groupLeadsBy status', () => {
  it('buckets by status in natural pipeline order', () => {
    const leads = [
      lead({ status: 'Qualified' as any }),
      lead({ status: 'New' as any }),
      lead({ status: 'New' as any }),
    ];
    const groups = groupLeadsBy(leads, 'status');
    expect(groups.map((g) => g.label)).toEqual(['New', 'Qualified']);
    expect(groups[0].count).toBe(2);
  });

  it('sends missing status to a "No status" bucket sorted last', () => {
    const leads = [lead({ status: '' as any }), lead({ status: 'New' as any })];
    const groups = groupLeadsBy(leads, 'status');
    expect(groups[groups.length - 1].label).toBe('No status');
  });
});

describe('groupLeadsBy owner', () => {
  it('groups by owner id and labels with the name; unassigned last', () => {
    const leads = [
      lead({ owner: owner('u1', 'Alice') as any }),
      lead({ owner: undefined as any }),
      lead({ owner: owner('u1', 'Alice') as any }),
    ];
    const groups = groupLeadsBy(leads, 'owner');
    expect(groups[0]).toMatchObject({ key: 'u1', label: 'Alice', count: 2 });
    expect(groups[groups.length - 1].label).toBe('Unassigned');
  });
});

describe('groupLeadsBy priority', () => {
  it('buckets numeric priority by descending size', () => {
    const leads = [
      lead({ priority: 1 } as Partial<Lead>),
      lead({ priority: 2 } as Partial<Lead>),
      lead({ priority: 2 } as Partial<Lead>),
    ];
    const groups = groupLeadsBy(leads, 'priority');
    expect(groups[0]).toMatchObject({ key: '2', count: 2 });
  });
});

describe('groupLeadsBy lead_health', () => {
  it('orders hot → warm → cold', () => {
    const leads = [
      lead({ last_activity_at: daysAgo(20) } as Partial<Lead>), // cold
      lead({ last_activity_at: daysAgo(1) } as Partial<Lead>), // hot
      lead({ last_activity_at: daysAgo(10) } as Partial<Lead>), // warm
    ];
    const groups = groupLeadsBy(leads, 'lead_health', NOW);
    expect(groups.map((g) => g.key)).toEqual(['hot', 'warm', 'cold']);
  });
});

describe('purity', () => {
  it('does not mutate the input array', () => {
    const leads = [lead({ status: 'New' as any }), lead({ status: 'Lost' as any })];
    const snapshot = [...leads];
    groupLeadsBy(leads, 'status');
    expect(leads).toEqual(snapshot);
  });
});
