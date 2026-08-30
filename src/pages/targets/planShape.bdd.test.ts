import { describe, it, expect } from 'vitest';
import { findLine, lineLabel, lineUnit, planPeriods } from './planShape';

/**
 * BDD specs for reading a plan response.
 *
 * The fixture below mirrors what `GET /target-plans/:id` really returns:
 * periods hang off each LINE, and the metric arrives under a nested
 * `task_type` relation. Two shipped panels read `plan.periods` and
 * `line.metric_name` instead — neither exists, so one rendered an empty
 * section and the other captioned its dropdown with raw UUIDs. Nothing threw,
 * nothing logged; the screens looked finished and did nothing.
 *
 * These specs exist so the shape is asserted once instead of assumed.
 */

// Shaped exactly like target-plans.service.getPlan(): `...plan` with
// `lines[]`, each line spread from crm_sales_targets plus its own periods,
// and `task_type` from the joined crm_sales_task_types row.
const PLAN = {
  id: 'plan-1',
  name: 'Q4 New Business',
  lines: [
    {
      id: 'line-revenue',
      task_type_id: 'tt-revenue',
      value: 100000,
      task_type: { name: 'Revenue', unit: 'currency' },
      periods: [
        {
          id: 'p-2',
          target_line_id: 'line-revenue',
          sequence: 2,
          period_start: '2026-11-01',
          period_end: '2026-11-30',
          target_value: 60000,
        },
        {
          id: 'p-1',
          target_line_id: 'line-revenue',
          sequence: 1,
          period_start: '2026-10-01',
          period_end: '2026-10-31',
          target_value: 40000,
        },
      ],
    },
    {
      id: 'line-demos',
      task_type_id: 'tt-demos',
      value: 20,
      task_type: { name: 'Demos', unit: 'count' },
      periods: [
        {
          id: 'p-3',
          target_line_id: 'line-demos',
          sequence: 1,
          period_start: '2026-10-01',
          period_end: '2026-10-31',
          target_value: 20,
        },
      ],
    },
  ],
};

describe('Given a plan response', () => {
  it('When its period buckets are read / Then they come from the LINES, not a top-level field', () => {
    // `plan.periods` does not exist. Reading it yielded [] and the editor
    // showed no period section at all.
    expect((PLAN as any).periods).toBeUndefined();
    expect(planPeriods(PLAN)).toHaveLength(3);
  });

  it('When buckets are listed / Then each says which metric it belongs to', () => {
    // A plan can carry several lines, so an unlabelled list of date ranges is
    // ambiguous — two buckets for the same month would be indistinguishable.
    const labels = planPeriods(PLAN).map((p) => p.lineLabel);
    expect(new Set(labels)).toEqual(new Set(['Revenue', 'Demos']));
  });

  it('When buckets are listed / Then they are ordered by metric, then by sequence', () => {
    // The fixture stores November before October on purpose: insertion order
    // is not calendar order.
    const rows = planPeriods(PLAN);
    expect(rows.map((r) => `${r.lineLabel}:${r.period_start}`)).toEqual([
      'Demos:2026-10-01',
      'Revenue:2026-10-01',
      'Revenue:2026-11-01',
    ]);
  });

  it('When a plan has no lines / Then it yields no buckets rather than throwing', () => {
    expect(planPeriods({ lines: [] })).toEqual([]);
    expect(planPeriods(null)).toEqual([]);
    expect(planPeriods(undefined)).toEqual([]);
  });

  it('When a line has no periods / Then it contributes nothing', () => {
    expect(
      planPeriods({ lines: [{ id: 'l', task_type_id: 't' }] }),
    ).toEqual([]);
  });
});

describe('Given a plan line', () => {
  it('When its caption is read / Then it comes from the nested task_type relation', () => {
    expect(lineLabel(PLAN.lines[0])).toBe('Revenue');
  });

  it('When the relation is absent / Then a flat metric_name is used', () => {
    expect(lineLabel({ id: 'l', task_type_id: 'tt', metric_name: 'Calls' })).toBe(
      'Calls',
    );
  });

  it('When nothing names it / Then the id shows rather than a blank caption', () => {
    // A blank option in a dropdown is unselectable-looking; a UUID is ugly but
    // at least distinguishes two lines.
    expect(lineLabel({ id: 'l', task_type_id: 'tt-xyz' })).toBe('tt-xyz');
  });

  it('When the name is only whitespace / Then it is not treated as a name', () => {
    expect(
      lineLabel({ id: 'l', task_type_id: 'tt-xyz', task_type: { name: '   ' } }),
    ).toBe('tt-xyz');
  });

  it('When its unit is read / Then the nested relation wins, so money formats as money', () => {
    expect(lineUnit(PLAN.lines[0])).toBe('currency');
    expect(lineUnit(PLAN.lines[1])).toBe('count');
    expect(lineUnit({ id: 'l', task_type_id: 't' })).toBeUndefined();
  });
});

describe('Given a metric chosen for allocation', () => {
  it('When the line is looked up / Then the team target for THAT metric is found', () => {
    expect(findLine(PLAN, 'tt-demos')?.value).toBe(20);
  });

  it('When the metric is not on the plan / Then nothing is returned rather than the first line', () => {
    // Falling back to lines[0] would allocate against the wrong target.
    expect(findLine(PLAN, 'tt-missing')).toBeUndefined();
  });
});
