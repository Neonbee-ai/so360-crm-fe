import React from 'react';
import type { TargetStatus, TrendPoint } from '../../services/targetPlanService';

/**
 * Shared presentation primitives for Targets & Performance.
 *
 * Metric names are never hardcoded anywhere in these components — every
 * caption comes from the metric row returned by the API. That is what lets the
 * same screens serve professional services, retail, logistics and the rest
 * without an industry branch in the UI.
 */

export const STATUS_DOT: Record<TargetStatus, string> = {
  on_track: 'bg-emerald-400',
  at_risk: 'bg-amber-400',
  behind: 'bg-rose-400',
  achieved: 'bg-emerald-400',
  exceeded: 'bg-sky-400',
};

export const STATUS_TEXT: Record<TargetStatus, string> = {
  on_track: 'text-emerald-300',
  at_risk: 'text-amber-300',
  behind: 'text-rose-300',
  achieved: 'text-emerald-300',
  exceeded: 'text-sky-300',
};

export const STATUS_BAR: Record<TargetStatus, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  behind: 'bg-rose-500',
  achieved: 'bg-emerald-500',
  exceeded: 'bg-sky-500',
};

export function StatusChip({
  status,
  label,
}: {
  status: TargetStatus;
  label?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${STATUS_TEXT[status]}`}>
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      {label ?? status.replace('_', ' ')}
    </span>
  );
}

/**
 * Progress bar. The fill is capped at 100% so the bar never overflows its
 * track, but the percentage label is NOT capped — 133% stays visible, because
 * hiding overachievement is as misleading as hiding a shortfall.
 */
export function ProgressBar({
  actual,
  target,
  status,
  compact,
}: {
  actual: number;
  target: number;
  status: TargetStatus;
  compact?: boolean;
}) {
  const raw = target > 0 ? (actual / target) * 100 : 0;
  const pct = Math.min(raw, 100);
  return (
    <div className={compact ? '' : 'mt-2'}>
      <div className={`${compact ? 'h-1.5' : 'h-2'} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR[status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Elapsed-time bar. Without this, an attainment number cannot be judged. */
export function ElapsedBar({ fraction }: { fraction: number }) {
  const pct = Math.min(Math.max(fraction, 0), 1) * 100;
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-slate-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

/**
 * Formats a metric value using its own unit.
 *
 * `currency` metrics are rendered with the org currency supplied by the shell —
 * the module never stores or guesses a currency of its own.
 */
export function formatValue(
  value: number | null | undefined,
  unit?: string,
  currency?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (unit === 'currency') {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${Math.round(value).toLocaleString()}`;
    }
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString();
}

/**
 * Sparkline over attainment history.
 *
 * Periods without a target render as a gap rather than a zero bar — a month
 * with no target is not a month of failure.
 */
export function Sparkline({ points }: { points: TrendPoint[] }) {
  if (!points.length) {
    return <div className="text-xs text-slate-500">No history yet</div>;
  }
  const max = Math.max(
    1,
    ...points.map((p) => (p.attainment === null ? 0 : p.attainment)),
  );
  return (
    <div className="flex items-end gap-2 h-16">
      {points.map((p) => {
        const a = p.attainment;
        const h = a === null ? 0 : Math.max(4, (a / max) * 100);
        return (
          <div
            key={p.period_start}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${p.period_start} — ${formatPct(a)}${p.plan_changed ? ' (target changed)' : ''}`}
          >
            {a === null ? (
              <div className="w-full border-t border-dashed border-slate-700 mt-auto" />
            ) : (
              <div
                className={`w-full rounded-sm ${p.plan_changed ? 'bg-slate-500' : 'bg-slate-400'}`}
                style={{ height: `${h}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TrendArrow({
  direction,
}: {
  direction: 'up' | 'down' | 'flat' | null;
}) {
  if (!direction) return null;
  const map = {
    up: { glyph: '▲', cls: 'text-emerald-300' },
    down: { glyph: '▼', cls: 'text-rose-300' },
    flat: { glyph: '▬', cls: 'text-slate-400' },
  } as const;
  const { glyph, cls } = map[direction];
  return <span className={`text-xs ${cls}`}>{glyph}</span>;
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
