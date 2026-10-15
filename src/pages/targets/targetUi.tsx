import React from 'react';
import { EmptyState as DsEmptyState, DatePicker, Button, Skeleton, Alert, type BadgeTone, type Person } from '@so360/design-system';
import { AlertCircle, Inbox, UserX } from 'lucide-react';
import type { TargetStatus, TrendPoint } from '../../services/targetPlanService';

/**
 * Shared presentation primitives for Targets & Performance.
 *
 * Metric names are never hardcoded anywhere in these components — every
 * caption comes from the metric row returned by the API. That is what lets the
 * same screens serve professional services, retail, logistics and the rest
 * without an industry branch in the UI.
 */

/** Badge tone per target status — Comb Badge draws the chip. */
export const STATUS_TONE: Record<TargetStatus, BadgeTone> = {
  on_track: 'success',
  at_risk: 'warning',
  behind: 'danger',
  achieved: 'success',
  exceeded: 'info',
};

const PROGRESS_TONE: Record<TargetStatus, 'success' | 'warning' | 'danger' | 'brand' | 'exceeded'> = {
  on_track: 'success',
  at_risk: 'warning',
  behind: 'danger',
  achieved: 'success',
  exceeded: 'exceeded',
};

/** Default chip text for a status when the API supplies no label. */
export function statusText(status: TargetStatus, label?: string): string {
  return label ?? status.replace('_', ' ');
}

/**
 * Props for the DS Progress bar. Progress clamps the fill for every tone but
 * `exceeded`, which shows a full bar with an overflow marker and the true
 * percentage — 133% stays visible, because hiding overachievement is as
 * misleading as hiding a shortfall.
 */
export function attainmentProps(actual: number, target: number, status: TargetStatus) {
  const raw = target > 0 ? (actual / target) * 100 : 0;
  return {
    value: raw,
    max: 100,
    tone: PROGRESS_TONE[status],
  };
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

/** Status legend items (dot + label) for the Comb StatusLegend, one per target status. */
export const STATUS_LEGEND: { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }[] = [
  { label: 'On track', tone: 'success' },
  { label: 'At risk', tone: 'warning' },
  { label: 'Behind', tone: 'danger' },
  { label: 'Achieved', tone: 'success' },
  { label: 'Exceeded', tone: 'info' },
];

/**
 * Data for the DS Sparkline over attainment history, in percent.
 *
 * Periods without a target are `null` so they render as a gap rather than a
 * zero bar — a month with no target is not a month of failure. Periods whose
 * target was edited mid-flight become markers.
 */
export function trendSparkline(points: TrendPoint[]) {
  return {
    data: points.map((p) => (p.attainment === null ? null : Math.round(p.attainment * 100))),
    markers: points.flatMap((p, index) =>
      p.plan_changed ? [{ index, label: `${p.period_start} — target changed` }] : [],
    ),
  };
}

/** Signed change in attainment (percentage points) from the first to the last period that had a target. */
export function trendDelta(
  points: TrendPoint[],
  direction: 'up' | 'down' | 'flat' | null,
): number {
  if (!direction || direction === 'flat') return 0;
  const known = points.filter((p) => p.attainment !== null) as (TrendPoint & { attainment: number })[];
  const delta =
    known.length > 1 ? Math.abs(known[known.length - 1].attainment - known[0].attainment) * 100 : 0;
  const mag = Math.max(Math.round(delta), 1);
  return direction === 'up' ? mag : -mag;
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

function fetchDirectory(): Promise<DirectoryPerson[]> {
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
  return directoryPromise;
}

/**
 * Data source for the DS `PeopleSelector` (`loadOptions`): the broker-route
 * directory mapped onto the selector's `Person` shape. Shared promise, so any
 * number of pickers on a page cost one request.
 */
export function loadDirectoryPeople(): Promise<Person[]> {
  return fetchDirectory().then((rows) =>
    rows.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email ?? '',
      job_title: p.job_title ?? undefined,
      department_name: p.department_name ?? undefined,
      status: 'active',
      type: 'employee',
    })),
  );
}

/** Normalises a PeopleSelector change value to a single person id ('' when cleared). */
export function personIdOf(v: string | string[] | null): string {
  return typeof v === 'string' ? v : '';
}

export function usePeopleDirectory() {
  const [people, setPeople] = React.useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetchDirectory()
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
    <Alert variant="warning">Showing the period containing {asOf}, not today.</Alert>
  );
}
