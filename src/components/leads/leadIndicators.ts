import type { Lead } from '../../types/crm';

// Pure, DOM-free helpers that derive the grid's engagement indicators — lead
// health, last-activity recency, and next-follow-up status — from a lead. `now`
// is injectable so the logic is deterministic under test.

const DAY_MS = 86_400_000;

const parseMs = (value?: string | null): number | null => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
};

/**
 * Most recent activity timestamp (ms) for a lead: the denormalised
 * last_activity_at column if present, else the latest of the embedded
 * activities, else null (no activity on record).
 */
export function lastActivityMs(lead: Lead): number | null {
  const denorm = parseMs((lead as { last_activity_at?: string }).last_activity_at);
  if (denorm != null) return denorm;
  const acts = Array.isArray(lead.activities) ? lead.activities : [];
  let max: number | null = null;
  for (const a of acts) {
    const t = parseMs((a as { date?: string; created_at?: string })?.date ?? (a as { created_at?: string })?.created_at);
    if (t != null && (max == null || t > max)) max = t;
  }
  return max;
}

export type HealthLevel = 'hot' | 'warm' | 'cold';

/**
 * Lead health from engagement recency:
 *   • activity within 3 days  → hot
 *   • activity within 14 days → warm
 *   • older / no activity     → cold (a brand-new lead with no activity yet is
 *                                     warm for its first 3 days, not punished)
 */
export function computeLeadHealth(lead: Lead, now: number = Date.now()): { level: HealthLevel; label: string } {
  const last = lastActivityMs(lead);
  if (last != null) {
    const days = (now - last) / DAY_MS;
    if (days <= 3) return { level: 'hot', label: 'Hot' };
    if (days <= 14) return { level: 'warm', label: 'Warm' };
    return { level: 'cold', label: 'Cold' };
  }
  const created = parseMs(lead.created_at);
  if (created != null && (now - created) / DAY_MS <= 3) return { level: 'warm', label: 'Warm' };
  return { level: 'cold', label: 'Cold' };
}

/** Compact relative time: "just now", "5m ago", "3h ago", "Yesterday", "4d ago", else a date. */
export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

/** Last-activity descriptor; `stale` flags leads untouched for 14+ days (or ever). */
export function describeLastActivity(lead: Lead, now: number = Date.now()): { label: string; stale: boolean } {
  const last = lastActivityMs(lead);
  if (last == null) return { label: 'No activity', stale: true };
  const days = (now - last) / DAY_MS;
  return { label: formatRelativeTime(last, now), stale: days >= 14 };
}

export type FollowUpTone = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none';

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Next-follow-up descriptor from lead.next_follow_up, bucketed relative to today:
 * overdue (before today), today, tomorrow, upcoming (a date), or none.
 */
export function describeNextFollowUp(lead: Lead, now: number = Date.now()): { label: string; tone: FollowUpTone } {
  const due = parseMs((lead as { next_follow_up?: string }).next_follow_up);
  if (due == null) return { label: '—', tone: 'none' };
  const today = startOfDay(now);
  const dueDay = startOfDay(due);
  const dayDiff = Math.round((dueDay - today) / DAY_MS);
  if (dayDiff < 0) return { label: 'Overdue', tone: 'overdue' };
  if (dayDiff === 0) return { label: 'Today', tone: 'today' };
  if (dayDiff === 1) return { label: 'Tomorrow', tone: 'tomorrow' };
  return { label: new Date(due).toLocaleDateString(), tone: 'upcoming' };
}
