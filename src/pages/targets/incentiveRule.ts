/**
 * Assembles the POST body for an incentive rule.
 *
 * Kept out of the component so the rules can be asserted directly. They are
 * not cosmetic: crm_incentive_rules accepts a loose `Record<string, any>` on
 * the backend, so a malformed rule inserts happily and then simply never fires
 * during calculation — a silent no-op is the worst possible failure for
 * something a manager is about to quote to a salesperson.
 */

export type IncentiveRuleType =
  | 'attainment_bonus'
  | 'per_unit'
  | 'deal_commission';

export interface IncentiveBand {
  min: string;
  max: string;
  percent: string;
}

export interface IncentiveRuleForm {
  name: string;
  rule_type: IncentiveRuleType;
  task_type_id: string;
  /** Entered as a percentage; stored as a fraction (100% → 1.0). */
  attainment_threshold_pct: string;
  amount: string;
  bands: IncentiveBand[];
  scope: 'all' | 'role' | 'person';
  applies_to_role: string;
  applies_to_person_id: string;
  effective_from: string;
  effective_to: string;
}

export const EMPTY_INCENTIVE_RULE: IncentiveRuleForm = {
  name: '',
  rule_type: 'attainment_bonus',
  task_type_id: '',
  attainment_threshold_pct: '100',
  amount: '',
  bands: [{ min: '0', max: '', percent: '' }],
  scope: 'all',
  applies_to_role: '',
  applies_to_person_id: '',
  effective_from: '',
  effective_to: '',
};

export type BuildResult =
  | { ok: true; payload: Record<string, any> }
  | { ok: false; error: string };

export function buildIncentiveRulePayload(form: IncentiveRuleForm): BuildResult {
  const name = form.name.trim();
  if (!name) return { ok: false, error: 'Give the rule a name.' };

  const payload: Record<string, any> = {
    name,
    rule_type: form.rule_type,
    is_active: true,
  };

  if (form.rule_type === 'attainment_bonus' || form.rule_type === 'per_unit') {
    if (!form.task_type_id) {
      return { ok: false, error: 'Choose the metric this rule watches.' };
    }
    payload.task_type_id = form.task_type_id;

    const amount = Number(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Enter an amount greater than zero.' };
    }
    payload.amount = amount;
  }

  if (form.rule_type === 'attainment_bonus') {
    const pct = Number(form.attainment_threshold_pct);
    if (!Number.isFinite(pct) || pct <= 0) {
      return { ok: false, error: 'Enter the attainment threshold as a percentage.' };
    }
    // Stored as a fraction because that is what the calculation compares
    // against; entering 100 and storing 100 would mean 10,000% attainment and
    // the bonus would never fire.
    payload.attainment_threshold = pct / 100;
  }

  if (form.rule_type === 'deal_commission') {
    const bands = form.bands
      .filter((b) => b.percent.trim() !== '' || b.min.trim() !== '' || b.max.trim() !== '')
      .map((b) => ({
        min: b.min.trim() === '' ? 0 : Number(b.min),
        // An open-ended top band is null, not a large number: a finite ceiling
        // silently stops paying commission on the biggest deals.
        max: b.max.trim() === '' ? null : Number(b.max),
        percent: Number(b.percent),
      }));

    if (!bands.length) return { ok: false, error: 'Add at least one band.' };

    for (const b of bands) {
      if (!Number.isFinite(b.min) || !Number.isFinite(b.percent) || b.percent <= 0) {
        return { ok: false, error: 'Every band needs a minimum and a percentage.' };
      }
      if (b.max !== null && (!Number.isFinite(b.max) || b.max <= b.min)) {
        return { ok: false, error: 'A band maximum must be above its minimum.' };
      }
    }

    const sorted = [...bands].sort((a, b) => a.min - b.min);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      if (prev.max === null) {
        return { ok: false, error: 'Only the highest band can be open-ended.' };
      }
      if (sorted[i].min < prev.max) {
        return { ok: false, error: 'Bands must not overlap.' };
      }
    }

    payload.bands = sorted;
  }

  if (form.scope === 'role') {
    const role = form.applies_to_role.trim();
    if (!role) return { ok: false, error: 'Name the role this rule applies to.' };
    payload.applies_to_role = role;
  }

  if (form.scope === 'person') {
    if (!form.applies_to_person_id) {
      return { ok: false, error: 'Choose the person this rule applies to.' };
    }
    payload.applies_to_person_id = form.applies_to_person_id;
  }

  if (form.effective_from) payload.effective_from = form.effective_from;
  if (form.effective_to) {
    if (form.effective_from && form.effective_to < form.effective_from) {
      return { ok: false, error: 'The end date is before the start date.' };
    }
    payload.effective_to = form.effective_to;
  }

  return { ok: true, payload };
}
