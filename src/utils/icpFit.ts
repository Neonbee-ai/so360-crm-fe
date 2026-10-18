/**
 * ICP fit helpers for the lead detail card.
 * Band thresholds mirror neonbee-linkedin-extension/src/lib/icp-engine.ts `fitBand`
 * (>=80 excellent, >=60 good, >=40 fair, else not_a_fit) — keep in sync.
 * Data shape: so360-crm-be linkedin-sync stores `icp_score`, `icp_criteria`
 * ({ [field]: points }) and `synced_at` in lead meta_data; the extension adds
 * `icp_name`, `icp_id`, `icp_fit`, `scraped_at`.
 */
export type FitBand = 'excellent' | 'good' | 'fair' | 'not_a_fit';

export const FIT_BAND_LABELS: Record<FitBand, string> = {
  excellent: 'Excellent fit',
  good: 'Good fit',
  fair: 'Fair fit',
  not_a_fit: 'Not a fit',
};

export function fitBand(score: number): FitBand {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'not_a_fit';
}

export type CriterionState = 'met' | 'missed' | 'unknown';
export interface IcpCriterionView { key: string; label: string; state: CriterionState; found?: string }

const humanise = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Accepts the extension's `{field: points}` map or an array of `{label|field, matched, found, points}`. */
export function parseIcpCriteria(raw: unknown): IcpCriterionView[] {
  if (Array.isArray(raw)) {
    return raw.map((c: any, i) => {
      const name = String(c?.label ?? c?.field ?? `Criterion ${i + 1}`);
      const state: CriterionState =
        typeof c?.matched === 'boolean' ? (c.matched ? 'met' : 'missed')
          : typeof c?.points === 'number' ? (c.points > 0 ? 'met' : 'missed') : 'unknown';
      const found = c?.found != null && c.found !== '' ? String(c.found) : undefined;
      return { key: `${name}-${i}`, label: c?.label ? name : humanise(name), state, found };
    });
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      label: humanise(k),
      state: typeof v === 'number' ? (v > 0 ? 'met' : 'missed') : 'unknown',
    }));
  }
  return [];
}
