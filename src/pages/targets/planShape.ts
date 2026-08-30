/**
 * Readers for the shape `GET /target-plans/:id` actually returns.
 *
 * That endpoint returns `lines[]`, each line carrying its own `periods[]` and
 * its metric under a nested `task_type` relation — there is NO top-level
 * `plan.periods`, and no `line.metric_name`. Reading the shape that seems
 * obvious produces an empty list or a UUID caption with no error anywhere:
 * the panel renders, looks finished, and silently does nothing. That is
 * exactly what shipped before these helpers existed.
 *
 * Encoded here and unit-tested against a fixture of the real response so the
 * shape is asserted once rather than assumed in every component.
 */

export interface PlanLine {
  id: string;
  task_type_id: string;
  value?: number | string | null;
  task_type?: { name?: string | null; unit?: string | null } | null;
  metric_name?: string | null;
  unit?: string | null;
  periods?: PlanPeriod[];
}

export interface PlanPeriod {
  id: string;
  target_line_id: string;
  sequence?: number;
  period_start: string;
  period_end: string;
  target_value: number | string;
}

export interface PlanPeriodRow extends PlanPeriod {
  /** Which metric this bucket belongs to — a plan can have several lines. */
  lineLabel: string;
  lineId: string;
}

/** A line's display name, falling back rather than rendering a bare UUID. */
export function lineLabel(line: PlanLine): string {
  return (
    line.task_type?.name?.trim() ||
    line.metric_name?.trim() ||
    line.task_type_id
  );
}

/** A line's unit, for currency vs count formatting. */
export function lineUnit(line: PlanLine): string | undefined {
  return line.task_type?.unit ?? line.unit ?? undefined;
}

/**
 * Every period bucket in the plan, flattened across lines and labelled.
 *
 * Sorted by line, then by the sequence the backend assigned — falling back to
 * period_start so a plan written before `sequence` existed still renders in
 * calendar order rather than insertion order.
 */
export function planPeriods(plan: { lines?: PlanLine[] } | null | undefined): PlanPeriodRow[] {
  const rows: PlanPeriodRow[] = [];
  for (const line of plan?.lines ?? []) {
    const label = lineLabel(line);
    for (const p of line.periods ?? []) {
      rows.push({ ...p, lineLabel: label, lineId: line.id });
    }
  }
  return rows.sort((a, b) => {
    if (a.lineId !== b.lineId) return a.lineLabel.localeCompare(b.lineLabel);
    const seq = (a.sequence ?? 0) - (b.sequence ?? 0);
    return seq !== 0 ? seq : a.period_start.localeCompare(b.period_start);
  });
}

/** The line matching a chosen metric, for allocation against its team target. */
export function findLine(
  plan: { lines?: PlanLine[] } | null | undefined,
  taskTypeId: string,
): PlanLine | undefined {
  return (plan?.lines ?? []).find((l) => l.task_type_id === taskTypeId);
}
