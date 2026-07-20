import { describe, it, expect } from 'vitest';
import {
  FILTERABLE_FIELDS,
  getField,
  operatorsForType,
  operatorTakesNoValue,
  operatorTakesTwoValues,
  operatorTakesList,
  createRule,
  createGroup,
  emptyFilter,
  isGroup,
  isRuleComplete,
  countActiveRules,
  serializeFilter,
  addRule,
  addGroup,
  removeNode,
  updateRule,
  setCombinator,
  type FilterGroup,
  type FilterRule,
} from './leadFilterModel';

describe('field catalog', () => {
  it('every field maps to a defined type and is retrievable by key', () => {
    for (const f of FILTERABLE_FIELDS) {
      expect(['text', 'number', 'date', 'enum', 'boolean']).toContain(f.type);
      expect(getField(f.key)).toEqual(f);
    }
    expect(getField('nope')).toBeUndefined();
  });

  it('status is an enum with options', () => {
    const status = getField('status')!;
    expect(status.type).toBe('enum');
    expect(status.options?.length).toBeGreaterThan(0);
  });
});

describe('operatorsForType', () => {
  it('offers ordering ops for numbers and dates but not plain text', () => {
    expect(operatorsForType('number').map((o) => o.op)).toContain('between');
    expect(operatorsForType('date').map((o) => o.op)).toContain('gte');
    expect(operatorsForType('text').map((o) => o.op)).not.toContain('between');
  });
  it('offers is/is-any-of for enums', () => {
    expect(operatorsForType('enum').map((o) => o.op)).toEqual(
      expect.arrayContaining(['eq', 'in']),
    );
  });
});

describe('operator arity predicates', () => {
  it('classifies value-less, two-value and list operators', () => {
    expect(operatorTakesNoValue('is_null')).toBe(true);
    expect(operatorTakesNoValue('eq')).toBe(false);
    expect(operatorTakesTwoValues('between')).toBe(true);
    expect(operatorTakesList('in')).toBe(true);
  });
});

describe('constructors', () => {
  it('createRule seeds the first field with a valid operator', () => {
    const r = createRule();
    const field = getField(r.field)!;
    expect(operatorsForType(field.type).some((o) => o.op === r.op)).toBe(true);
  });
  it('createGroup and emptyFilter start empty and AND by default', () => {
    expect(createGroup().rules).toEqual([]);
    expect(emptyFilter()).toEqual({ combinator: 'and', rules: [] });
  });
});

describe('isRuleComplete', () => {
  it('value-less operators are always complete', () => {
    expect(isRuleComplete({ field: 'company_name', op: 'is_null' })).toBe(true);
    expect(isRuleComplete({ field: 'company_name', op: 'not_null' })).toBe(true);
  });
  it('scalar operators need a non-empty value', () => {
    expect(isRuleComplete({ field: 'company_name', op: 'eq', value: '' })).toBe(false);
    expect(isRuleComplete({ field: 'company_name', op: 'eq', value: 'Acme' })).toBe(true);
  });
  it('between needs two non-empty bounds', () => {
    expect(isRuleComplete({ field: 'score', op: 'between', value: ['1', ''] })).toBe(false);
    expect(isRuleComplete({ field: 'score', op: 'between', value: ['1', '9'] })).toBe(true);
  });
  it('in needs a non-empty list', () => {
    expect(isRuleComplete({ field: 'status', op: 'in', value: [] })).toBe(false);
    expect(isRuleComplete({ field: 'status', op: 'in', value: ['New'] })).toBe(true);
  });
});

describe('countActiveRules', () => {
  it('counts only complete leaves across nesting', () => {
    const tree: FilterGroup = {
      combinator: 'and',
      rules: [
        { field: 'company_name', op: 'eq', value: 'Acme' }, // complete
        { field: 'email', op: 'eq', value: '' }, // incomplete
        {
          combinator: 'or',
          rules: [
            { field: 'status', op: 'is_null' }, // complete
            { field: 'city', op: 'contains', value: 'LA' }, // complete
          ],
        },
      ],
    };
    expect(countActiveRules(tree)).toBe(3);
    expect(countActiveRules(null)).toBe(0);
  });
});

describe('serializeFilter', () => {
  it('drops incomplete rules and empty groups, returning null when nothing remains', () => {
    expect(serializeFilter(emptyFilter())).toBeNull();
    const onlyIncomplete: FilterGroup = {
      combinator: 'and',
      rules: [{ field: 'company_name', op: 'eq', value: '' }],
    };
    expect(serializeFilter(onlyIncomplete)).toBeNull();
  });

  it('strips value from value-less operators on the wire', () => {
    const tree: FilterGroup = {
      combinator: 'and',
      rules: [{ field: 'company_name', op: 'is_null', value: 'ignored' } as FilterRule],
    };
    expect(serializeFilter(tree)).toEqual({
      combinator: 'and',
      rules: [{ field: 'company_name', op: 'is_null' }],
    });
  });

  it('preserves nested groups that contain at least one complete rule', () => {
    const tree: FilterGroup = {
      combinator: 'and',
      rules: [
        { field: 'company_name', op: 'contains', value: 'ac' },
        {
          combinator: 'or',
          rules: [
            { field: 'status', op: 'eq', value: 'New' },
            { field: 'email', op: 'eq', value: '' }, // pruned
          ],
        },
      ],
    };
    expect(serializeFilter(tree)).toEqual({
      combinator: 'and',
      rules: [
        { field: 'company_name', op: 'contains', value: 'ac' },
        { combinator: 'or', rules: [{ field: 'status', op: 'eq', value: 'New' }] },
      ],
    });
  });
});

describe('immutable tree edits', () => {
  it('addRule appends without mutating the source', () => {
    const root = emptyFilter();
    const next = addRule(root);
    expect(root.rules).toHaveLength(0);
    expect(next.rules).toHaveLength(1);
    expect(isGroup(next.rules[0])).toBe(false);
  });

  it('addGroup appends a nested group; addRule targets it by path', () => {
    let root = addGroup(emptyFilter());
    root = addRule(root, [0]);
    const nested = root.rules[0] as FilterGroup;
    expect(isGroup(nested)).toBe(true);
    expect(nested.rules).toHaveLength(1);
  });

  it('removeNode deletes by path and empties the root at []', () => {
    let root = addRule(addRule(emptyFilter()));
    root = removeNode(root, [0]);
    expect(root.rules).toHaveLength(1);
    expect(removeNode(root, []).rules).toHaveLength(0);
  });

  it('updateRule re-seeds operator + clears value when field type changes', () => {
    let root = addRule(emptyFilter()); // seeded to first (text) field
    root = updateRule(root, [0], { op: 'contains', value: 'ac' });
    // switch to a numeric field — 'contains' is invalid there
    root = updateRule(root, [0], { field: 'score' });
    const rule = root.rules[0] as FilterRule;
    expect(rule.field).toBe('score');
    expect(operatorsForType('number').some((o) => o.op === rule.op)).toBe(true);
    expect(rule.value).toBe('');
  });

  it('updateRule reshapes value when operator arity changes', () => {
    let root = addRule(emptyFilter());
    root = updateRule(root, [0], { field: 'score' });
    root = updateRule(root, [0], { op: 'between' });
    expect((root.rules[0] as FilterRule).value).toEqual(['', '']);
    root = updateRule(root, [0], { op: 'is_null' });
    expect((root.rules[0] as FilterRule).value).toBeUndefined();
  });

  it('setCombinator flips a group between AND and OR', () => {
    const root = setCombinator(emptyFilter(), [], 'or');
    expect(root.combinator).toBe('or');
  });
});

describe('edge cases & full-branch coverage', () => {
  it('operatorsForType maps boolean to the enum operator set', () => {
    expect(operatorsForType('boolean')).toEqual(operatorsForType('enum'));
  });

  it('createGroup honours an explicit combinator', () => {
    expect(createGroup('or')).toEqual({ combinator: 'or', rules: [] });
  });

  it('isRuleComplete rejects a rule with no field or op', () => {
    expect(isRuleComplete({ field: '', op: 'eq', value: 'x' } as FilterRule)).toBe(false);
    expect(isRuleComplete({ field: 'company_name', op: '' as any, value: 'x' })).toBe(false);
  });

  it('serializeFilter returns null for a null root', () => {
    expect(serializeFilter(null)).toBeNull();
  });

  it('addRule/addGroup target a nested group by path', () => {
    let root = addGroup(emptyFilter()); // root.rules[0] is a group
    root = addGroup(root, [0]); // nest a group inside it
    root = addRule(root, [0, 0]); // add a rule to the deeply-nested group
    const inner = (root.rules[0] as FilterGroup).rules[0] as FilterGroup;
    expect(isGroup(inner)).toBe(true);
    expect(inner.rules).toHaveLength(1);
    expect(isGroup(inner.rules[0])).toBe(false);
  });

  it('editing helpers are no-ops when the path points at a leaf rule', () => {
    let root = addRule(emptyFilter()); // rules[0] is a rule, not a group
    // Descending into a rule (path [0,0]) can add nothing.
    root = addRule(root, [0, 0]);
    expect((root.rules[0] as FilterGroup).rules).toBeUndefined();
    expect(root.rules).toHaveLength(1);
  });

  it('removeNode ignores an out-of-range index', () => {
    const root = addRule(emptyFilter());
    expect(removeNode(root, [9]).rules).toHaveLength(1);
  });

  it('updateRule is a no-op when the path lands on a group', () => {
    const root = addGroup(emptyFilter());
    const next = updateRule(root, [0], { value: 'x' });
    expect(next.rules[0]).toEqual({ combinator: 'and', rules: [] });
  });

  it('updateRule keeps the operator when the new field shares its type', () => {
    let root = addRule(emptyFilter()); // company_name / contains
    root = updateRule(root, [0], { value: 'ac' });
    root = updateRule(root, [0], { field: 'email' }); // still text
    const rule = root.rules[0] as FilterRule;
    expect(rule.field).toBe('email');
    expect(rule.op).toBe('contains');
    expect(rule.value).toBe('');
  });

  it('updateRule reshapes the value to an empty list for the "in" operator', () => {
    let root = addRule(emptyFilter());
    root = updateRule(root, [0], { field: 'status' }); // enum supports "in"
    root = updateRule(root, [0], { op: 'in' });
    expect((root.rules[0] as FilterRule).value).toEqual([]);
  });

  it('updateRule collapses a two-value array back to a scalar for scalar ops', () => {
    let root = addRule(emptyFilter());
    root = updateRule(root, [0], { field: 'score' });
    root = updateRule(root, [0], { op: 'between' }); // value -> ['', '']
    root = updateRule(root, [0], { op: 'eq' }); // scalar op -> ''
    expect((root.rules[0] as FilterRule).value).toBe('');
  });
});
