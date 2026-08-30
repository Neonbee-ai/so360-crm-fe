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

// ─── People ────────────────────────────────────────────────────────────────
//
// Every person field on these screens stores a People Connect person id, and
// People Connect stays the source of truth for display data. The directory is
// fetched through crm-be's broker route rather than People Connect's public
// `/people`, which needs permissions a CRM user does not hold.

export interface DirectoryPerson {
  id: string;
  full_name: string;
  email?: string | null;
  employee_id?: string | null;
  job_title?: string | null;
  department_name?: string | null;
}

// Module-level so the directory is fetched once per page load no matter how
// many pickers and name labels mount. The promise itself is cached, so
// concurrent mounts share a single in-flight request instead of racing.
let directoryPromise: Promise<DirectoryPerson[]> | null = null;

export function __resetPeopleDirectoryForTests() {
  directoryPromise = null;
}

export function usePeopleDirectory() {
  const [people, setPeople] = React.useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!directoryPromise) {
      directoryPromise = import('../../services/crmService')
        .then((m) => m.crmService.getSalesReps())
        .then((rows) =>
          [...(rows ?? [])].sort((a, b) =>
            (a.full_name || '').localeCompare(b.full_name || ''),
          ),
        )
        .catch((e) => {
          // Do not cache a rejection: a transient failure would otherwise
          // leave every picker on the page permanently empty.
          directoryPromise = null;
          throw e;
        });
    }
    directoryPromise
      .then((rows) => {
        if (!alive) return;
        setPeople(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const byId = React.useMemo(() => {
    const m = new Map<string, DirectoryPerson>();
    for (const p of people) m.set(p.id, p);
    return m;
  }, [people]);

  return { people, byId, loading, failed };
}

/**
 * Renders a person id as their name.
 *
 * Falls back to a shortened id rather than blank: an unresolvable person
 * (left the org, directory call failed) must still be distinguishable from
 * the next row, otherwise a table of eight-character blanks looks like a
 * rendering bug.
 */
export function PersonName({ id }: { id?: string | null }) {
  const { byId, loading } = usePeopleDirectory();
  if (!id) return <span className="text-slate-500">—</span>;
  const person = byId.get(id);
  if (person) return <span>{person.full_name}</span>;
  return (
    <span className="text-slate-400" title={id}>
      {loading ? '…' : String(id).slice(0, 8)}
    </span>
  );
}

/**
 * Search-suggest picker over the People Connect directory.
 *
 * Filtering is client-side across every displayed attribute, matching the
 * behaviour of the deal owner picker: the registry API only indexes name,
 * email and employee id, so searching by job title or department would
 * otherwise silently return nothing.
 */
export function PersonPicker({
  value,
  onChange,
  placeholder = 'Search people…',
  allowClear = true,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const { people, byId, loading, failed } = usePeopleDirectory();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const selected = value ? byId.get(value) : undefined;

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? people.filter((p) =>
          [p.full_name, p.email, p.employee_id, p.job_title, p.department_name]
            .some((v) => (v || '').toLowerCase().includes(q)),
        )
      : people;
    return rows.slice(0, 50);
  }, [people, query]);

  if (value && selected && !open) {
    return (
      <div className="flex items-center gap-2" ref={boxRef}>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setOpen(true);
          }}
          className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 text-left"
        >
          {selected.full_name}
          {selected.job_title ? (
            <span className="text-slate-400"> · {selected.job_title}</span>
          ) : null}
        </button>
        {allowClear ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            clear
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={
          failed ? 'People directory unavailable' : loading ? 'Loading people…' : placeholder
        }
        role="combobox"
        aria-expanded={open}
        aria-label="Person"
      />
      {open && !loading && !failed ? (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-slate-700 bg-slate-900 py-1 text-sm shadow-lg">
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-slate-500">No matching people</li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="block w-full px-2 py-1.5 text-left text-slate-100 hover:bg-slate-800"
                  onClick={() => {
                    onChange(p.id);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {p.full_name}
                  {p.job_title || p.department_name ? (
                    <span className="text-slate-400">
                      {' · '}
                      {[p.job_title, p.department_name].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Review periods ────────────────────────────────────────────────────────

/**
 * Turns a month or quarter into the exact period bounds a review needs.
 *
 * Reviews are opened by choosing a month or a quarter, never by typing two
 * dates: a hand-typed range silently produces a review covering a period no
 * plan matches, and the pre-filled numbers then look wrong for reasons nobody
 * can see.
 *
 * All arithmetic is UTC. Building these with local-time `new Date(y, m, d)`
 * shifts the boundary by a day for anyone west of UTC, which would quietly
 * move a deal between two adjacent review periods.
 */
export function reviewPeriodBounds(
  periodType: 'monthly' | 'quarterly',
  anchor: string,
): { period_start: string; period_end: string } | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (periodType === 'monthly') {
    const m = /^(\d{4})-(\d{2})$/.exec(anchor);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return {
      period_start: iso(new Date(Date.UTC(year, month - 1, 1))),
      // Day 0 of the NEXT month is the last day of this one, which avoids a
      // leap-year table.
      period_end: iso(new Date(Date.UTC(year, month, 0))),
    };
  }

  const q = /^(\d{4})-Q([1-4])$/.exec(anchor);
  if (!q) return null;
  const year = Number(q[1]);
  const quarter = Number(q[2]);
  const startMonth = (quarter - 1) * 3;
  return {
    period_start: iso(new Date(Date.UTC(year, startMonth, 1))),
    period_end: iso(new Date(Date.UTC(year, startMonth + 3, 0))),
  };
}

// ─── Period selection ──────────────────────────────────────────────────────

/**
 * Chooses which period a screen reads.
 *
 * These screens were hardwired to today, so a past month could not be looked
 * at even though every number for it was already stored. An empty value means
 * "today" and sends no `as_of` at all, leaving the default to the backend
 * rather than pinning it to the browser's clock — a browser in a different
 * timezone would otherwise ask for the wrong day.
 */
export function PeriodPicker({
  value,
  onChange,
  label = 'As of',
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
        <input
          type="date"
          aria-label={label}
          className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {value ? (
        <button
          className="pb-1.5 text-xs text-slate-400 hover:text-slate-200"
          onClick={() => onChange('')}
        >
          today
        </button>
      ) : null}
    </div>
  );
}

/**
 * Marks a view as historical.
 *
 * Without it a past period is indistinguishable from the current one at a
 * glance, and a manager can easily read last quarter's shortfall as this
 * quarter's.
 */
export function AsOfBanner({ asOf }: { asOf: string }) {
  if (!asOf) return null;
  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300">
      Showing the period containing {asOf}, not today.
    </div>
  );
}
