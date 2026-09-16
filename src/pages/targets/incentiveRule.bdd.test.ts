import { describe, it, expect } from 'vitest';
import {
  EMPTY_INCENTIVE_RULE,
  buildIncentiveRulePayload,
  type IncentiveRuleForm,
} from './incentiveRule';

/**
 * BDD specs for incentive rule assembly.
 *
 * crm_incentive_rules accepts a loose object on the backend, so a malformed
 * rule inserts successfully and then never fires during calculation. The
 * failure mode is silence: a manager configures a bonus, sees it listed, and
 * it simply never pays out. Every rule below exists to make that impossible
 * at the point of entry.
 */

const form = (over: Partial<IncentiveRuleForm> = {}): IncentiveRuleForm => ({
  ...EMPTY_INCENTIVE_RULE,
  ...over,
});

const ok = (r: ReturnType<typeof buildIncentiveRulePayload>) => {
  if (!r.ok) throw new Error(`expected success, got: ${r.error}`);
  return r.payload;
};

const err = (r: ReturnType<typeof buildIncentiveRulePayload>) => {
  if (r.ok) throw new Error('expected a validation failure');
  return r.error;
};

describe('Given a rule with no name', () => {
  it('When it is saved / Then it is rejected', () => {
    expect(err(buildIncentiveRulePayload(form({ name: '   ' })))).toMatch(/name/i);
  });
});

describe('Given an attainment bonus', () => {
  const base = form({
    name: 'Q3 bonus',
    rule_type: 'attainment_bonus',
    task_type_id: 'tt-1',
    amount: '500',
    attainment_threshold_pct: '90',
  });

  it('When the threshold is entered as a percentage / Then it is stored as a fraction', () => {
    // The calculation compares against attainment where 1.0 is 100%. Storing
    // 90 rather than 0.9 would mean 9,000% and the bonus could never fire.
    expect(ok(buildIncentiveRulePayload(base)).attainment_threshold).toBe(0.9);
  });

  it('When no metric is chosen / Then it is rejected', () => {
    expect(
      err(buildIncentiveRulePayload({ ...base, task_type_id: '' })),
    ).toMatch(/metric/i);
  });

  it('When the amount is zero or absent / Then it is rejected', () => {
    expect(err(buildIncentiveRulePayload({ ...base, amount: '0' }))).toMatch(
      /amount/i,
    );
    expect(err(buildIncentiveRulePayload({ ...base, amount: '' }))).toMatch(
      /amount/i,
    );
  });

  it('When the threshold is not a number / Then it is rejected', () => {
    expect(
      err(
        buildIncentiveRulePayload({ ...base, attainment_threshold_pct: 'abc' }),
      ),
    ).toMatch(/attainment/i);
  });
});

describe('Given a per-unit rule', () => {
  const base = form({
    name: 'Per demo',
    rule_type: 'per_unit',
    task_type_id: 'tt-2',
    amount: '25',
  });

  it('When it is saved / Then it carries the metric and amount and no threshold', () => {
    const payload = ok(buildIncentiveRulePayload(base));
    expect(payload).toMatchObject({ task_type_id: 'tt-2', amount: 25 });
    expect(payload.attainment_threshold).toBeUndefined();
  });
});

describe('Given a banded deal commission', () => {
  const withBands = (bands: IncentiveRuleForm['bands']) =>
    form({ name: 'Commission', rule_type: 'deal_commission', bands });

  it('When the top band has no maximum / Then it is stored open-ended', () => {
    // A finite ceiling silently stops paying commission on the biggest deals,
    // which is the exact opposite of the intent.
    const payload = ok(
      buildIncentiveRulePayload(
        withBands([
          { min: '0', max: '10000', percent: '1' },
          { min: '10000', max: '', percent: '3' },
        ]),
      ),
    );
    expect(payload.bands).toEqual([
      { min: 0, max: 10000, percent: 1 },
      { min: 10000, max: null, percent: 3 },
    ]);
  });

  it('When bands are entered out of order / Then they are stored sorted', () => {
    const payload = ok(
      buildIncentiveRulePayload(
        withBands([
          { min: '10000', max: '', percent: '3' },
          { min: '0', max: '10000', percent: '1' },
        ]),
      ),
    );
    expect(payload.bands.map((b: any) => b.min)).toEqual([0, 10000]);
  });

  it('When bands overlap / Then it is rejected', () => {
    // Overlapping bands make the payout depend on evaluation order, so the
    // same deal could be worth two different amounts.
    expect(
      err(
        buildIncentiveRulePayload(
          withBands([
            { min: '0', max: '10000', percent: '1' },
            { min: '5000', max: '20000', percent: '2' },
          ]),
        ),
      ),
    ).toMatch(/overlap/i);
  });

  it('When an open-ended band is not the highest / Then it is rejected', () => {
    expect(
      err(
        buildIncentiveRulePayload(
          withBands([
            { min: '0', max: '', percent: '1' },
            { min: '10000', max: '20000', percent: '2' },
          ]),
        ),
      ),
    ).toMatch(/highest band/i);
  });

  it('When a band maximum is below its minimum / Then it is rejected', () => {
    expect(
      err(
        buildIncentiveRulePayload(
          withBands([{ min: '10000', max: '5000', percent: '1' }]),
        ),
      ),
    ).toMatch(/above its minimum/i);
  });

  it('When no bands are filled in / Then it is rejected', () => {
    expect(
      err(
        buildIncentiveRulePayload(
          withBands([{ min: '', max: '', percent: '' }]),
        ),
      ),
    ).toMatch(/at least one band/i);
  });

  it('When it is saved / Then it carries no metric, because it reads deals directly', () => {
    const payload = ok(
      buildIncentiveRulePayload(
        withBands([{ min: '0', max: '', percent: '2' }]),
      ),
    );
    expect(payload.task_type_id).toBeUndefined();
    expect(payload.amount).toBeUndefined();
  });
});

describe('Given a rule scoped to a role or person', () => {
  const base = form({
    name: 'Scoped',
    rule_type: 'per_unit',
    task_type_id: 'tt-3',
    amount: '10',
  });

  it('When scoped to everyone / Then no scope fields are sent', () => {
    const payload = ok(buildIncentiveRulePayload(base));
    expect(payload.applies_to_role).toBeUndefined();
    expect(payload.applies_to_person_id).toBeUndefined();
  });

  it('When scoped to a role with none named / Then it is rejected', () => {
    expect(
      err(buildIncentiveRulePayload({ ...base, scope: 'role' })),
    ).toMatch(/role/i);
  });

  it('When scoped to a person with none chosen / Then it is rejected', () => {
    // Otherwise the rule silently widens to everyone.
    expect(
      err(buildIncentiveRulePayload({ ...base, scope: 'person' })),
    ).toMatch(/person/i);
  });

  it('When a person is chosen / Then their id is sent', () => {
    const payload = ok(
      buildIncentiveRulePayload({
        ...base,
        scope: 'person',
        applies_to_person_id: 'person-1',
      }),
    );
    expect(payload.applies_to_person_id).toBe('person-1');
  });
});

describe('Given effective dates', () => {
  const base = form({
    name: 'Dated',
    rule_type: 'per_unit',
    task_type_id: 'tt-4',
    amount: '5',
  });

  it('When they are left empty / Then they are omitted rather than sent as blanks', () => {
    const payload = ok(buildIncentiveRulePayload(base));
    expect('effective_from' in payload).toBe(false);
    expect('effective_to' in payload).toBe(false);
  });

  it('When the end is before the start / Then it is rejected', () => {
    expect(
      err(
        buildIncentiveRulePayload({
          ...base,
          effective_from: '2026-06-01',
          effective_to: '2026-05-01',
        }),
      ),
    ).toMatch(/before the start/i);
  });
});
