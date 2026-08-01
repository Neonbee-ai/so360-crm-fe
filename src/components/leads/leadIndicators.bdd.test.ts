import { describe, it, expect } from 'vitest';
import {
  lastActivityMs,
  computeLeadHealth,
  formatRelativeTime,
  describeLastActivity,
  describeNextFollowUp,
} from './leadIndicators';
import type { Lead } from '../../types/crm';

const NOW = Date.parse('2026-07-10T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW + n * 86_400_000).toISOString();
const lead = (over: Partial<Lead> = {}): Lead => ({ id: 'l1', created_at: daysAgo(30), activities: [], ...(over as object) } as Lead);

describe('lastActivityMs', () => {
  it('prefers the denormalised last_activity_at column', () => {
    const l = lead({ last_activity_at: daysAgo(2), activities: [{ date: daysAgo(10) }] } as Partial<Lead>);
    expect(lastActivityMs(l)).toBe(Date.parse(daysAgo(2)));
  });

  it('falls back to the latest embedded activity', () => {
    const l = lead({ activities: [{ date: daysAgo(10) }, { date: daysAgo(4) }] } as Partial<Lead>);
    expect(lastActivityMs(l)).toBe(Date.parse(daysAgo(4)));
  });

  it('returns null when there is no activity', () => {
    expect(lastActivityMs(lead())).toBeNull();
  });
});

describe('computeLeadHealth', () => {
  it('is hot within 3 days of activity', () => {
    expect(computeLeadHealth(lead({ last_activity_at: daysAgo(1) } as Partial<Lead>), NOW).level).toBe('hot');
  });

  it('is warm within 14 days of activity', () => {
    expect(computeLeadHealth(lead({ last_activity_at: daysAgo(10) } as Partial<Lead>), NOW).level).toBe('warm');
  });

  it('is cold when activity is older than 14 days', () => {
    expect(computeLeadHealth(lead({ last_activity_at: daysAgo(20) } as Partial<Lead>), NOW).level).toBe('cold');
  });

  it('is warm for a brand-new lead with no activity', () => {
    expect(computeLeadHealth(lead({ created_at: daysAgo(1) }), NOW).level).toBe('warm');
  });

  it('is cold for an old lead with no activity', () => {
    expect(computeLeadHealth(lead({ created_at: daysAgo(60) }), NOW).level).toBe('cold');
  });
});

describe('formatRelativeTime', () => {
  it('says "just now" for the present or future', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatRelativeTime(NOW + 5000, NOW)).toBe('just now');
  });
  it('formats minutes and hours', () => {
    expect(formatRelativeTime(NOW - 5 * 60000, NOW)).toBe('5m ago');
    expect(formatRelativeTime(NOW - 3 * 3600000, NOW)).toBe('3h ago');
  });
  it('says Yesterday at 1 day and Nd ago beyond', () => {
    expect(formatRelativeTime(NOW - 26 * 3600000, NOW)).toBe('Yesterday');
    expect(formatRelativeTime(NOW - 5 * 86_400_000, NOW)).toBe('5d ago');
  });
  it('falls back to a date past 30 days', () => {
    expect(formatRelativeTime(NOW - 40 * 86_400_000, NOW)).toMatch(/\d/);
  });
});

describe('describeLastActivity', () => {
  it('flags never-touched leads as stale', () => {
    expect(describeLastActivity(lead(), NOW)).toEqual({ label: 'No activity', stale: true });
  });
  it('marks 14+ days as stale', () => {
    expect(describeLastActivity(lead({ last_activity_at: daysAgo(15) } as Partial<Lead>), NOW).stale).toBe(true);
  });
  it('recent activity is not stale', () => {
    const d = describeLastActivity(lead({ last_activity_at: daysAgo(1) } as Partial<Lead>), NOW);
    expect(d.stale).toBe(false);
    expect(d.label).toBe('Yesterday');
  });
});

describe('describeNextFollowUp', () => {
  it('none when unset', () => {
    expect(describeNextFollowUp(lead(), NOW)).toEqual({ label: '—', tone: 'none' });
  });
  it('overdue when before today', () => {
    expect(describeNextFollowUp(lead({ next_follow_up: daysAgo(2) } as Partial<Lead>), NOW).tone).toBe('overdue');
  });
  it('today / tomorrow buckets', () => {
    expect(describeNextFollowUp(lead({ next_follow_up: daysAhead(0) } as Partial<Lead>), NOW).tone).toBe('today');
    expect(describeNextFollowUp(lead({ next_follow_up: daysAhead(1) } as Partial<Lead>), NOW).tone).toBe('tomorrow');
  });
  it('upcoming for a further date', () => {
    expect(describeNextFollowUp(lead({ next_follow_up: daysAhead(9) } as Partial<Lead>), NOW).tone).toBe('upcoming');
  });
});
