/**
 * Team plan allocation.
 *
 * A team plan is never auto-split. The backend deliberately allocates only
 * what a manager types, and reports allocated against the team target rather
 * than forcing them to agree — an even split is almost always wrong, and a
 * forced match hides the deliberate over-commit most teams plan for.
 *
 * This module holds the arithmetic and the validation so both can be asserted
 * without a browser. Each entry becomes a real child plan for that person, so
 * a bad entry is not a form error, it is a wrong target someone gets measured
 * against.
 */

export interface AllocationRow {
  key: string;
  person_id: string;
  value: string;
}

export interface AllocationSummary {
  allocated: number;
  teamTarget: number;
  remaining: number;
  /** Allocated above the team target — surfaced, never blocked. */
  over: boolean;
}

export function summariseAllocation(
  teamTarget: number,
  rows: AllocationRow[],
): AllocationSummary {
  const allocated = rows.reduce((sum, r) => {
    const n = Number(r.value);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  // Rounded to two places: floating-point addition of currency-like values
  // otherwise reports a remainder of 1e-13 and the panel claims the team is
  // short by an invisible amount.
  // `|| 0` collapses -0 to 0. Rounding a tiny negative remainder yields -0,
  // which fails an equality check against 0 and would render as "-0".
  const round = (n: number) => Math.round(n * 100) / 100 || 0;

  return {
    allocated: round(allocated),
    teamTarget: round(teamTarget),
    remaining: round(teamTarget - allocated),
    over: round(allocated) > round(teamTarget),
  };
}

export type AllocationCheck =
  | { ok: true; entries: Array<{ person_id: string; value: number }> }
  | { ok: false; error: string };

export function buildAllocationEntries(rows: AllocationRow[]): AllocationCheck {
  const filled = rows.filter((r) => r.person_id || r.value.trim() !== '');
  if (!filled.length) return { ok: false, error: 'Add at least one person.' };

  const entries: Array<{ person_id: string; value: number }> = [];
  const seen = new Set<string>();

  for (const row of filled) {
    if (!row.person_id) {
      return { ok: false, error: 'Every row needs a person.' };
    }
    if (seen.has(row.person_id)) {
      // Two rows for one person would create two competing child plans, and
      // the overview would then show whichever the query happened to return.
      return { ok: false, error: 'The same person appears twice.' };
    }
    seen.add(row.person_id);

    const value = Number(row.value);
    if (row.value.trim() === '' || !Number.isFinite(value) || value <= 0) {
      return { ok: false, error: 'Every person needs a target above zero.' };
    }
    entries.push({ person_id: row.person_id, value });
  }

  return { ok: true, entries };
}
