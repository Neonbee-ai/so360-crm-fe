import { describe, it, expect } from 'vitest';
import {
  buildAllocationEntries,
  summariseAllocation,
  type AllocationRow,
} from './allocation';

/**
 * BDD specs for team plan allocation.
 *
 * Each entry becomes a real child plan owned by that person, so a bad row is
 * not a form error — it is a wrong number somebody gets measured against for a
 * quarter.
 */

const row = (over: Partial<AllocationRow> = {}): AllocationRow => ({
  key: 'k',
  person_id: '',
  value: '',
  ...over,
});

const entries = (r: ReturnType<typeof buildAllocationEntries>) => {
  if (!r.ok) throw new Error(`expected success, got: ${r.error}`);
  return r.entries;
};

const failure = (r: ReturnType<typeof buildAllocationEntries>) => {
  if (r.ok) throw new Error('expected a validation failure');
  return r.error;
};

describe('Given a manager allocating a team target', () => {
  it('When rows are filled / Then each becomes an entry with a numeric target', () => {
    expect(
      entries(
        buildAllocationEntries([
          row({ key: 'a', person_id: 'p1', value: '40' }),
          row({ key: 'b', person_id: 'p2', value: '60' }),
        ]),
      ),
    ).toEqual([
      { person_id: 'p1', value: 40 },
      { person_id: 'p2', value: 60 },
    ]);
  });

  it('When a row has a value but no person / Then it is rejected', () => {
    expect(
      failure(buildAllocationEntries([row({ key: 'a', value: '40' })])),
    ).toMatch(/needs a person/i);
  });

  it('When a person has no target / Then it is rejected', () => {
    expect(
      failure(
        buildAllocationEntries([row({ key: 'a', person_id: 'p1', value: '' })]),
      ),
    ).toMatch(/above zero/i);
  });

  it('When a target is zero or negative / Then it is rejected', () => {
    // A zero target is a plan nobody can miss, which is worse than no plan.
    for (const v of ['0', '-5']) {
      expect(
        failure(
          buildAllocationEntries([
            row({ key: 'a', person_id: 'p1', value: v }),
          ]),
        ),
      ).toMatch(/above zero/i);
    }
  });

  it('When the same person appears twice / Then it is rejected', () => {
    // Two child plans for one person means the overview shows whichever the
    // query happens to return first.
    expect(
      failure(
        buildAllocationEntries([
          row({ key: 'a', person_id: 'p1', value: '40' }),
          row({ key: 'b', person_id: 'p1', value: '60' }),
        ]),
      ),
    ).toMatch(/twice/i);
  });

  it('When every row is untouched / Then it asks for at least one person', () => {
    expect(failure(buildAllocationEntries([row(), row()]))).toMatch(
      /at least one person/i,
    );
  });

  it('When some rows are untouched / Then they are ignored rather than failing', () => {
    // The panel always renders a trailing blank row; failing on it would make
    // the form impossible to submit.
    expect(
      entries(
        buildAllocationEntries([
          row({ key: 'a', person_id: 'p1', value: '40' }),
          row({ key: 'b' }),
        ]),
      ),
    ).toEqual([{ person_id: 'p1', value: 40 }]);
  });
});

describe('Given the running allocation total', () => {
  it('When it is below the team target / Then the remainder is reported', () => {
    const s = summariseAllocation(100, [
      row({ key: 'a', person_id: 'p1', value: '40' }),
      row({ key: 'b', person_id: 'p2', value: '35' }),
    ]);
    expect(s).toMatchObject({ allocated: 75, remaining: 25, over: false });
  });

  it('When it exceeds the team target / Then it is flagged but still allowed', () => {
    // Teams routinely commit above target on purpose; blocking it would force
    // a dishonest number into the plan.
    const s = summariseAllocation(100, [
      row({ key: 'a', person_id: 'p1', value: '80' }),
      row({ key: 'b', person_id: 'p2', value: '40' }),
    ]);
    expect(s.over).toBe(true);
    expect(s.remaining).toBe(-20);
  });

  it('When the values are fractional / Then no floating-point dust is reported', () => {
    // 0.1 + 0.2 leaves a remainder of ~1e-17 unrounded, and the panel would
    // claim the team is short by an invisible amount.
    const s = summariseAllocation(0.3, [
      row({ key: 'a', person_id: 'p1', value: '0.1' }),
      row({ key: 'b', person_id: 'p2', value: '0.2' }),
    ]);
    expect(s.remaining).toBe(0);
    expect(s.over).toBe(false);
  });

  it('When a value is not a number / Then it contributes nothing rather than NaN', () => {
    const s = summariseAllocation(100, [
      row({ key: 'a', person_id: 'p1', value: 'abc' }),
      row({ key: 'b', person_id: 'p2', value: '25' }),
    ]);
    expect(s.allocated).toBe(25);
  });
});
