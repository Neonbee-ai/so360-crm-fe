import React from 'react';
import { useCrmFeatureFlag } from '../../hooks/useCrmFeatureFlag';
import { fitBand, FIT_BAND_LABELS, parseIcpCriteria, type FitBand } from '../../utils/icpFit';

export const ICP_FLAG = 'submodule:crm:icp_manager';

const BAND_STYLE: Record<FitBand, string> = {
  excellent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  good: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  fair: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  not_a_fit: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};
const ICON = { met: '✓', missed: '✗', unknown: '?' } as const;
const ICON_STYLE = { met: 'text-emerald-400', missed: 'text-rose-400', unknown: 'text-slate-400' } as const;

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
  const score = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!enabled || !Number.isFinite(score)) return null;

  const band = fitBand(score);
  const criteria = parseIcpCriteria(meta?.icp_criteria);
  const date = formatDate(meta?.last_synced_at ?? meta?.synced_at);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm" data-testid="icp-fit-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-slate-300">ICP fit</h3>
        <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${BAND_STYLE[band]}`} data-testid="icp-fit-band">
          {FIT_BAND_LABELS[band]}
        </span>
      </div>
      <p className="text-3xl font-black text-slate-50" data-testid="icp-fit-score">{`${Math.round(score)} / 100`}</p>
      {meta?.icp_name && <p className="mt-1 text-xs font-medium text-slate-400" data-testid="icp-fit-name">{String(meta.icp_name)}</p>}
      {criteria.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-800/50 pt-4" data-testid="icp-fit-criteria">
          {criteria.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-xs text-slate-300" data-testid={`icp-criterion-${c.state}`}>
              <span aria-label={c.state} className={`font-black ${ICON_STYLE[c.state]}`}>{ICON[c.state]}</span>
              <span>{c.label}{c.found ? <span className="text-slate-400">{` — ${c.found}`}</span> : null}</span>
            </li>
          ))}
        </ul>
      )}
      {date && <p className="mt-4 text-xs text-slate-400" data-testid="icp-fit-source">{`Source: LinkedIn · ${date}`}</p>}
    </section>
  );
}
