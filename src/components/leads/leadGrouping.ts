/**
 * leadGrouping.ts — Group-by core for the enterprise leads grid (Phase 5).
 *
 * Pure, dependency-free grouping so it can be unit-tested without a DOM and
 * reused by the grid render path. Grouping is a display-only transform over the
 * already-sorted lead list — it never refetches and never mutates its input.
 */
import type { Lead } from '../../types/crm';
import { computeLeadHealth } from './leadIndicators';

export type GroupByKey = 'none' | 'status' | 'owner' | 'source' | 'priority' | 'lead_health';

export interface LeadGroup {
  /** Stable identity for collapse-state + React keys. */
  key: string;
  /** Human label shown on the group header. */
  label: string;
  leads: Lead[];
  count: number;
}

export const GROUP_BY_OPTIONS: Array<{ key: GroupByKey; label: string }> = [
  { key: 'none', label: 'No grouping' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'source', label: 'Source' },
  { key: 'priority', label: 'Priority' },
  { key: 'lead_health', label: 'Lead Health' },
];

const UNASSIGNED = '__unassigned__';

/** Resolve the raw grouping bucket (key + label) for a single lead. */
function bucketFor(lead: Lead, groupBy: GroupByKey, now?: number): { key: string; label: string } {
  switch (groupBy) {
    case 'status': {
      const v = (lead.status ?? '').toString().trim();
      return v ? { key: v, label: v } : { key: UNASSIGNED, label: 'No status' };
    }
    case 'owner': {
      const owner = lead.owner;
      if (owner?.id) return { key: owner.id, label: owner.full_name || owner.email || 'Unknown owner' };
      return { key: UNASSIGNED, label: 'Unassigned' };
    }
    case 'source': {
      const v = (lead.source ?? '').toString().trim();
      return v ? { key: v, label: v } : { key: UNASSIGNED, label: 'No source' };
    }
    case 'priority': {
      const p = (lead as { priority?: unknown }).priority;
      if (p === undefined || p === null || p === '') return { key: UNASSIGNED, label: 'No priority' };
      const s = String(p);
      return { key: s, label: s };
    }
    case 'lead_health': {
      const level = computeLeadHealth(lead, now).level; // 'hot' | 'warm' | 'cold'
      const label = level.charAt(0).toUpperCase() + level.slice(1);
      return { key: level, label };
    }
    default:
      return { key: UNASSIGNED, label: 'All' };
  }
}

/** Fixed display order for the buckets that have a natural ranking. */
const ORDER: Partial<Record<GroupByKey, string[]>> = {
  lead_health: ['hot', 'warm', 'cold'],
  status: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Converted', 'Lost'],
};

/**
 * Group an (already sorted) lead list by the given dimension, preserving the
 * incoming lead order within each group. Groups are ordered by their dimension's
 * natural ranking when one exists, otherwise by descending size then label; the
 * "unassigned" bucket always sorts last. Returns a single synthetic group for
 * `none` so callers can render uniformly.
 */
export function groupLeadsBy(leads: Lead[], groupBy: GroupByKey, now?: number): LeadGroup[] {
  if (groupBy === 'none') {
    return [{ key: '__all__', label: 'All', leads, count: leads.length }];
  }

  const map = new Map<string, LeadGroup>();
  for (const lead of leads) {
    const { key, label } = bucketFor(lead, groupBy, now);
    const existing = map.get(key);
    if (existing) {
      existing.leads.push(lead);
      existing.count += 1;
    } else {
      map.set(key, { key, label, leads: [lead], count: 1 });
    }
  }

  const groups = Array.from(map.values());
  const order = ORDER[groupBy];
  groups.sort((a, b) => {
    // Unassigned always last.
    if (a.key === UNASSIGNED && b.key !== UNASSIGNED) return 1;
    if (b.key === UNASSIGNED && a.key !== UNASSIGNED) return -1;
    if (order) {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      if (ia !== -1 || ib !== -1) {
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      }
    }
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return groups;
}
