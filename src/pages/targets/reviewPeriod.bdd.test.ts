import { describe, it, expect } from 'vitest';
import { reviewPeriodBounds } from './targetUi';

/**
 * BDD specs for review period bounds.
 *
 * A review is opened by choosing a month or a quarter, never by typing two
 * dates. A hand-typed range produces a review covering a period no plan
 * matches, and the pre-filled numbers then look wrong for reasons nobody on
 * the screen can see.
 */

describe('Given a monthly review', () => {
  it('When a month is chosen / Then the period spans that whole month', () => {
    expect(reviewPeriodBounds('monthly', '2026-08')).toEqual({
      period_start: '2026-08-01',
      period_end: '2026-08-31',
    });
  });

  it('When the month is a short one / Then the last day is correct', () => {
    expect(reviewPeriodBounds('monthly', '2026-04')?.period_end).toBe(
      '2026-04-30',
    );
  });

  it('When February falls in a leap year / Then the 29th is included', () => {
    // Day 0 of the next month rather than a hardcoded table, so leap years
    // need no special case.
    expect(reviewPeriodBounds('monthly', '2028-02')?.period_end).toBe(
      '2028-02-29',
    );
    expect(reviewPeriodBounds('monthly', '2026-02')?.period_end).toBe(
      '2026-02-28',
    );
  });

  it('When December is chosen / Then the period does not roll into the next year', () => {
    expect(reviewPeriodBounds('monthly', '2026-12')).toEqual({
      period_start: '2026-12-01',
      period_end: '2026-12-31',
    });
  });
});

describe('Given a quarterly review', () => {
  it.each([
    ['2026-Q1', '2026-01-01', '2026-03-31'],
    ['2026-Q2', '2026-04-01', '2026-06-30'],
    ['2026-Q3', '2026-07-01', '2026-09-30'],
    ['2026-Q4', '2026-10-01', '2026-12-31'],
  ])('When %s is chosen / Then it spans %s → %s', (anchor, start, end) => {
    expect(reviewPeriodBounds('quarterly', anchor)).toEqual({
      period_start: start,
      period_end: end,
    });
  });
});

describe('Given a malformed or impossible anchor', () => {
  it.each([
    ['monthly', '2026-13'],
    ['monthly', '2026-00'],
    ['monthly', 'August'],
    ['monthly', ''],
    ['quarterly', '2026-Q5'],
    ['quarterly', '2026-08'],
  ] as const)('When %s / %s is given / Then no period is produced', (type, anchor) => {
    // Returning null keeps the submit button disabled. Falling back to "today"
    // would open a review over a period the manager never chose.
    expect(reviewPeriodBounds(type, anchor)).toBeNull();
  });
});

describe('Given a timezone west of UTC', () => {
  it('When bounds are computed / Then they do not shift by a day', () => {
    // Built with Date.UTC throughout. Local-time construction moves the
    // boundary for anyone behind UTC, which would quietly reassign a deal
    // closed on the 1st to the previous review period.
    expect(reviewPeriodBounds('monthly', '2026-08')?.period_start).toBe(
      '2026-08-01',
    );
    expect(reviewPeriodBounds('quarterly', '2026-Q1')?.period_start).toBe(
      '2026-01-01',
    );
  });
});
