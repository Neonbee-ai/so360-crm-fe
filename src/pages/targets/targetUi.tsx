import React from 'react';
import { EmptyState as DsEmptyState, DatePicker, Button, IconButton, TextField, Skeleton } from '@so360/design-system';
import { AlertCircle, Inbox, UserX, X } from 'lucide-react';
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
  on_track: 'bg-success',
  at_risk: 'bg-warning',
  behind: 'bg-danger',
  achieved: 'bg-success',
  exceeded: 'bg-info',
};

export const STATUS_TEXT: Record<TargetStatus, string> = {
  on_track: 'text-success',
  at_risk: 'text-warning',
  behind: 'text-danger',
  achieved: 'text-success',
  exceeded: 'text-info',
};

export const STATUS_BAR: Record<TargetStatus, string> = {
  on_track: 'bg-success',
  at_risk: 'bg-warning',
  behind: 'bg-danger',
  achieved: 'bg-success',
  exceeded: 'bg-info',
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
      <div className={`${compact ? 'h-1.5' : 'h-2'} bg-surface-raised rounded-full overflow-hidden`}>
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
    <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-fg-subtle"
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
    return <div className="text-xs text-fg-muted">No history yet</div>;
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
              <div className="w-full border-t border-dashed border-line mt-auto" />
            ) : (
              <div
                className={`w-full rounded-sm ${p.plan_changed ? 'bg-fg-subtle' : 'bg-fg-subtle'}`}
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
    up: { glyph: '▲', cls: 'text-success' },
    down: { glyph: '▼', cls: 'text-danger' },
    flat: { glyph: '▬', cls: 'text-fg-subtle' },
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
    <div className="rounded-lg border border-line bg-surface-sunken p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

type EmptyIcon = React.ComponentType<{ className?: string }>;

/**
 * In-frame empty state. Short title + muted description. `message` is kept for
 * older call sites and maps to the description under a neutral title.
 */
export function EmptyState({
  title,
  description,
  message,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  message?: string;
  icon?: EmptyIcon;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <DsEmptyState
      icon={icon ?? Inbox}
      title={title ?? 'Nothing here yet'}
      description={description ?? message}
      action={action}
    />
  );
}

/** True when the API says the signed-in user has no People Connect person. */
export function isUnlinkedProfileError(error: string | null | undefined): boolean {
  return !!error && /no people connect person|not linked|person is linked/i.test(error);
}

/**
 * In-frame error. Always rendered inside the page's floorplan so the header
 * stays; an unlinked profile gets its own explanation instead of raw API text.
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  if (isUnlinkedProfileError(error)) {
    return (
      <DsEmptyState
        icon={UserX}
        title="Your profile isn't linked to People Connect"
        description="Ask an admin to link your user to a person in People Connect to see targets."
      />
    );
  }
  return (
    <DsEmptyState
      icon={AlertCircle}
      title="Couldn't load this page"
      description={error}
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
  );
}

/** Skeleton shown inside the floorplan while data loads. */
export function LoadingState() {
  return (
    <div data-testid="targets-loading">
      <Skeleton variant="text" lines={5} />
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
  if (!id) return <span className="text-fg-muted">—</span>;
  const person = byId.get(id);
  if (person) return <span>{person.full_name}</span>;
  return (
    <span className="text-fg-subtle" title={id}>
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
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setQuery('');
            setOpen(true);
          }}
        >
          {selected.full_name}
          {selected.job_title ? (
            <span className="text-fg-subtle"> · {selected.job_title}</span>
          ) : null}
        </Button>
        {allowClear ? (
          <IconButton
            label="Clear selection"
            icon={<X size={14} aria-hidden="true" />}
            onClick={() => {
              onChange('');
              setQuery('');
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <TextField
        name="target-person-query"
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
        <ul className="absolute z-menu mt-1 max-h-60 w-full overflow-auto rounded border border-line bg-surface py-1 text-sm">
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-fg-muted">No matching people</li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start border-0"
                  onClick={() => {
                    onChange(p.id);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {p.full_name}
                  {p.job_title || p.department_name ? (
                    <span className="text-fg-subtle">
                      {' · '}
                      {[p.job_title, p.department_name].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </Button>
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
        <DatePicker
          name={`date-${label.toLowerCase().replace(/\s+/g, '-')}`}
          label={label}
          value={value}
          onChange={(v: string) => onChange(v)}
        />
      </div>
      {value ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange('')}>
          today
        </Button>
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
    <div className="rounded border border-warning/30 bg-warning/5 px-3 py-1.5 text-xs text-warning">
      Showing the period containing {asOf}, not today.
    </div>
  );
}
