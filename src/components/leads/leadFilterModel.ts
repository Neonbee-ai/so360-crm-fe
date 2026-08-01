/**
 * leadFilterModel.ts — Advanced filter builder model (Phase 5, frontend).
 *
 * Pure, dependency-free helpers that build and manipulate the nested AND/OR
 * filter tree consumed by the backend `GET /leads?filter=<json>` param. The
 * shapes here mirror the backend contract in
 * `so360-crm-be/src/modules/leads/lead-query.util.ts` exactly — the backend is
 * the security boundary (it allow-lists columns/operators and quotes values), so
 * this layer only has to produce a well-formed, cleaned tree.
 *
 * All tree operations are immutable (return a new tree) so React state updates
 * stay predictable. Nodes are addressed by a numeric `path` (indices from the
 * root's `rules` down through nested groups), which keeps the UI wiring trivial.
 */

export type FilterCombinator = 'and' | 'or';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'ncontains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'is_null'
  | 'not_null'
  | 'between';

export interface FilterRule {
  field: string;
  op: FilterOperator;
  value?: any;
}

export interface FilterGroup {
  combinator: FilterCombinator;
  rules: Array<FilterRule | FilterGroup>;
}

export type FieldType = 'text' | 'number' | 'date' | 'enum' | 'boolean';

export interface FilterableField {
  /** Backend column name (must be in the backend LEAD_GRID_COLUMNS allow-list). */
  key: string;
  label: string;
  type: FieldType;
  /** For enum fields — the selectable values. */
  options?: Array<{ value: string; label: string }>;
}

/**
 * Catalog of columns the grid exposes to the filter builder. Every `key` here is
 * present in the backend allow-list; anything the backend later rejects is simply
 * dropped server-side, so this list can stay ahead of the backend safely.
 */
export const FILTERABLE_FIELDS: FilterableField[] = [
  { key: 'company_name', label: 'Company', type: 'text' },
  { key: 'contact_name', label: 'Contact', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'website', label: 'Website', type: 'text' },
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    options: [
      { value: 'New', label: 'New' },
      { value: 'Contacted', label: 'Contacted' },
      { value: 'Qualified', label: 'Qualified' },
      { value: 'Proposal Sent', label: 'Proposal Sent' },
      { value: 'Negotiation', label: 'Negotiation' },
      { value: 'Converted', label: 'Converted' },
      { value: 'Lost', label: 'Lost' },
    ],
  },
  { key: 'source', label: 'Source', type: 'text' },
  { key: 'campaign', label: 'Campaign', type: 'text' },
  { key: 'channel', label: 'Channel', type: 'text' },
  { key: 'owner_id', label: 'Owner', type: 'text' },
  { key: 'priority', label: 'Priority', type: 'number' },
  { key: 'score', label: 'Lead Score', type: 'number' },
  { key: 'deal_value', label: 'Deal Value', type: 'number' },
  { key: 'probability', label: 'Probability', type: 'number' },
  { key: 'tags', label: 'Tags', type: 'text' },
  { key: 'next_follow_up', label: 'Next Follow-up', type: 'date' },
  { key: 'last_activity_at', label: 'Last Activity', type: 'date' },
  { key: 'created_at', label: 'Created', type: 'date' },
  { key: 'updated_at', label: 'Updated', type: 'date' },
];

const FIELD_BY_KEY = new Map(FILTERABLE_FIELDS.map((f) => [f.key, f]));

export const getField = (key: string): FilterableField | undefined => FIELD_BY_KEY.get(key);

export interface OperatorSpec {
  op: FilterOperator;
  label: string;
}

const TEXT_OPS: OperatorSpec[] = [
  { op: 'contains', label: 'contains' },
  { op: 'ncontains', label: 'does not contain' },
  { op: 'eq', label: 'is' },
  { op: 'neq', label: 'is not' },
  { op: 'starts_with', label: 'starts with' },
  { op: 'ends_with', label: 'ends with' },
  { op: 'is_null', label: 'is empty' },
  { op: 'not_null', label: 'is not empty' },
];

const NUMERIC_OPS: OperatorSpec[] = [
  { op: 'eq', label: '=' },
  { op: 'neq', label: '≠' },
  { op: 'gt', label: '>' },
  { op: 'gte', label: '≥' },
  { op: 'lt', label: '<' },
  { op: 'lte', label: '≤' },
  { op: 'between', label: 'between' },
  { op: 'is_null', label: 'is empty' },
  { op: 'not_null', label: 'is not empty' },
];

const DATE_OPS: OperatorSpec[] = [
  { op: 'eq', label: 'on' },
  { op: 'gt', label: 'after' },
  { op: 'gte', label: 'on or after' },
  { op: 'lt', label: 'before' },
  { op: 'lte', label: 'on or before' },
  { op: 'between', label: 'between' },
  { op: 'is_null', label: 'is empty' },
  { op: 'not_null', label: 'is not empty' },
];

const ENUM_OPS: OperatorSpec[] = [
  { op: 'eq', label: 'is' },
  { op: 'neq', label: 'is not' },
  { op: 'in', label: 'is any of' },
  { op: 'is_null', label: 'is empty' },
  { op: 'not_null', label: 'is not empty' },
];

/** Operators available for a field type. */
export function operatorsForType(type: FieldType): OperatorSpec[] {
  switch (type) {
    case 'number':
      return NUMERIC_OPS;
    case 'date':
      return DATE_OPS;
    case 'enum':
    case 'boolean':
      return ENUM_OPS;
    case 'text':
    default:
      return TEXT_OPS;
  }
}

/** Operators that carry no value (`is empty` / `is not empty`). */
export function operatorTakesNoValue(op: FilterOperator): boolean {
  return op === 'is_null' || op === 'not_null';
}

/** Operators that take a pair of values (`between`). */
export function operatorTakesTwoValues(op: FilterOperator): boolean {
  return op === 'between';
}

/** Operators that take a list of values (`is any of`). */
export function operatorTakesList(op: FilterOperator): boolean {
  return op === 'in';
}

export const isGroup = (node: FilterRule | FilterGroup): node is FilterGroup =>
  !!node && typeof node === 'object' && Array.isArray((node as FilterGroup).rules);

/** A fresh, empty rule seeded to the first filterable field. */
export function createRule(): FilterRule {
  const first = FILTERABLE_FIELDS[0];
  return { field: first.key, op: operatorsForType(first.type)[0].op, value: '' };
}

/** A fresh empty group. */
export function createGroup(combinator: FilterCombinator = 'and'): FilterGroup {
  return { combinator, rules: [] };
}

/** The canonical empty root the builder starts from. */
export function emptyFilter(): FilterGroup {
  return { combinator: 'and', rules: [] };
}

/**
 * Is a single rule complete enough to send to the backend? Value-less operators
 * are always complete; `between` needs two non-empty bounds; `in` needs a
 * non-empty list; everything else needs a non-empty scalar.
 */
export function isRuleComplete(rule: FilterRule): boolean {
  if (!rule || !rule.field || !rule.op) return false;
  if (operatorTakesNoValue(rule.op)) return true;
  if (operatorTakesTwoValues(rule.op)) {
    return (
      Array.isArray(rule.value) &&
      rule.value.length === 2 &&
      rule.value.every((v) => v !== '' && v !== null && v !== undefined)
    );
  }
  if (operatorTakesList(rule.op)) {
    return Array.isArray(rule.value) && rule.value.filter((v) => v !== '' && v != null).length > 0;
  }
  return rule.value !== '' && rule.value !== null && rule.value !== undefined;
}

/** Number of complete leaf rules anywhere in the tree (drives the filter badge). */
export function countActiveRules(node: FilterGroup | FilterRule | null): number {
  if (!node) return 0;
  if (isGroup(node)) return node.rules.reduce((n, child) => n + countActiveRules(child), 0);
  return isRuleComplete(node) ? 1 : 0;
}

/**
 * Produce a cleaned tree containing only complete rules and non-empty groups,
 * ready to JSON-encode into the `filter` param. Returns null when nothing usable
 * remains — the caller then omits the param entirely (unchanged legacy behaviour).
 */
export function serializeFilter(root: FilterGroup | null): FilterGroup | null {
  if (!root) return null;
  const prune = (group: FilterGroup): FilterGroup | null => {
    const rules: Array<FilterRule | FilterGroup> = [];
    for (const child of group.rules) {
      if (isGroup(child)) {
        const cleaned = prune(child);
        if (cleaned) rules.push(cleaned);
      } else if (isRuleComplete(child)) {
        rules.push(normalizeRule(child));
      }
    }
    if (rules.length === 0) return null;
    return { combinator: group.combinator, rules };
  };
  return prune(root);
}

/** Coerce a rule's value into the exact wire shape the backend expects. */
function normalizeRule(rule: FilterRule): FilterRule {
  if (operatorTakesNoValue(rule.op)) return { field: rule.field, op: rule.op };
  return { field: rule.field, op: rule.op, value: rule.value };
}

// ── Immutable tree navigation & edits ───────────────────────────────────────
//
// A `path` is the list of `rules` indices from the root down to a node. The root
// group itself has path `[]`. Editing helpers rebuild only the spine to the
// touched node, leaving sibling subtrees referentially stable.

function replaceAt(
  group: FilterGroup,
  path: number[],
  transform: (node: FilterRule | FilterGroup) => FilterRule | FilterGroup | null,
): FilterGroup {
  if (path.length === 0) {
    // Transform applied to the root; a null result collapses to an empty root.
    const next = transform(group);
    return next && isGroup(next) ? next : emptyFilter();
  }
  const [head, ...rest] = path;
  const rules = group.rules.slice();
  const target = rules[head];
  if (target === undefined) return group;
  if (rest.length === 0) {
    const next = transform(target);
    if (next === null) rules.splice(head, 1);
    else rules[head] = next;
  } else if (isGroup(target)) {
    rules[head] = replaceAt(target, rest, transform);
  }
  return { ...group, rules };
}

/** Append a new empty rule to the group at `path` (root when omitted). */
export function addRule(root: FilterGroup, path: number[] = []): FilterGroup {
  return replaceAt(root, path, (node) =>
    isGroup(node) ? { ...node, rules: [...node.rules, createRule()] } : node,
  );
}

/** Append a new empty nested group to the group at `path`. */
export function addGroup(
  root: FilterGroup,
  path: number[] = [],
  combinator: FilterCombinator = 'and',
): FilterGroup {
  return replaceAt(root, path, (node) =>
    isGroup(node) ? { ...node, rules: [...node.rules, createGroup(combinator)] } : node,
  );
}

/** Remove the node at `path`. Removing the root yields an empty root. */
export function removeNode(root: FilterGroup, path: number[]): FilterGroup {
  if (path.length === 0) return emptyFilter();
  return replaceAt(root, path, () => null);
}

/**
 * Patch the rule at `path`. When the field changes we re-seed the operator (and
 * clear the value) if the previous operator isn't valid for the new field type,
 * so the UI never lands in an impossible field/operator pairing.
 */
export function updateRule(root: FilterGroup, path: number[], patch: Partial<FilterRule>): FilterGroup {
  return replaceAt(root, path, (node) => {
    if (isGroup(node)) return node;
    let next: FilterRule = { ...node, ...patch };
    if (patch.field && patch.field !== node.field) {
      const field = getField(patch.field);
      const ops = operatorsForType(field?.type ?? 'text');
      if (!ops.some((o) => o.op === next.op)) next = { ...next, op: ops[0].op };
      next = { ...next, value: '' };
    }
    if (patch.op && patch.op !== node.op) {
      // Reset the value shape when the operator's arity changes.
      if (operatorTakesNoValue(next.op)) next = { ...next, value: undefined };
      else if (operatorTakesTwoValues(next.op)) next = { ...next, value: ['', ''] };
      else if (operatorTakesList(next.op)) next = { ...next, value: [] };
      else if (Array.isArray(next.value)) next = { ...next, value: '' };
    }
    return next;
  });
}

/** Set a group's AND/OR combinator. */
export function setCombinator(root: FilterGroup, path: number[], combinator: FilterCombinator): FilterGroup {
  return replaceAt(root, path, (node) => (isGroup(node) ? { ...node, combinator } : node));
}
