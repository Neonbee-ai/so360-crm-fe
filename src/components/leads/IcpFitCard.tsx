import React from 'react';
import { Badge, Card, CountUp, type BadgeTone } from '@so360/design-system';
import { useCrmFeatureFlag } from '../../hooks/useCrmFeatureFlag';
import { fitBand, FIT_BAND_LABELS, parseIcpCriteria, type FitBand } from '../../utils/icpFit';

export const ICP_FLAG = 'submodule:crm:icp_manager';

const BAND_TONE: Record<FitBand, BadgeTone> = {
  excellent: 'success',
  good: 'info',
  fair: 'warning',
  not_a_fit: 'neutral',
};
const ICON = { met: '✓', missed: '✗', unknown: '?' } as const;
const ICON_STYLE = { met: 'text-success', missed: 'text-danger', unknown: 'text-fg-subtle' } as const;

function formatDate(iso: unknown): string | null {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Read-only ICP fit card; data comes from lead.custom_fields (API meta_data). Hidden without an icp_score or when the ICP flag is off. */
export default function IcpFitCard({ meta }: { meta?: Record<string, any> | null }) {
  const enabled = useCrmFeatureFlag(ICP_FLAG);
  const raw = meta?.icp_score;
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!enabled || !Number.isFinite(parsed)) return null;
  // Clamp + round once so the displayed score and its band always agree.
  const score = Math.min(100, Math.max(0, Math.round(parsed)));

  const band = fitBand(score);
  const criteria = parseIcpCriteria(meta?.icp_criteria);
  const date = formatDate(meta?.last_synced_at) ?? formatDate(meta?.synced_at);

  return (
    <div data-testid="icp-fit-card">
      <Card title="ICP fit" actions={<Badge tone={BAND_TONE[band]} data-testid="badge-icp-fit-band">{FIT_BAND_LABELS[band]}</Badge>}>
        <p className="text-3xl font-bold text-fg" data-testid="icp-fit-score"><CountUp value={`${score} / 100`} /></p>
        {meta?.icp_name && <p className="mt-1 text-xs text-fg-muted" data-testid="icp-fit-name">{String(meta.icp_name)}</p>}
        {criteria.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-line pt-4" data-testid="icp-fit-criteria">
            {criteria.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-xs text-fg" data-testid={`icp-criterion-${c.state}`}>
                <span aria-label={c.state} className={`font-bold ${ICON_STYLE[c.state]}`}>{ICON[c.state]}</span>
                <span>{c.label}{c.found ? <span className="text-fg-muted">{` — ${c.found}`}</span> : null}</span>
              </li>
            ))}
          </ul>
        )}
        {date && <p className="mt-4 text-xs text-fg-muted" data-testid="icp-fit-source">{`Source: LinkedIn · ${date}`}</p>}
      </Card>
    </div>
  );
}
