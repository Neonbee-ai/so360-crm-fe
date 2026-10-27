/**
 * LeadFilterBuilder.tsx — Advanced AND/OR filter builder UI (Phase 5, frontend).
 *
 * A self-contained slide-in panel that edits the nested filter tree from
 * `leadFilterModel.ts` and, on Apply, hands the serialized tree back to the
 * parent. The parent forwards it to the backend `GET /leads?filter=<json>` param
 * (already implemented). Rendering is recursive: a group renders its combinator
 * toggle plus its child rules and nested groups.
 *
 * The component is deliberately presentational + local-state only — it never
 * fetches. This keeps it trivial to test and impossible for it to break the
 * existing (unfiltered) leads flow when closed.
 */
import { useState } from 'react';
import { Plus, Trash2, X, FolderPlus, Filter as FilterIcon } from 'lucide-react';
import { Select, TextField, Button, IconButton } from '@so360/design-system';
import {
  FILTERABLE_FIELDS,
  getField,
  operatorsForType,
  operatorTakesNoValue,
  operatorTakesTwoValues,
  operatorTakesList,
  emptyFilter,
  isGroup,
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

interface LeadFilterBuilderProps {
  /** Current tree (controlled from the parent). Defaults to an empty AND root. */
  value?: FilterGroup | null;
  onApply: (serialized: FilterGroup | null) => void;
  onClose: () => void;
}

function RuleRow({
  rule,
  path,
  onChange,
  onRemove,
}: {
  rule: FilterRule;
  path: number[];
  onChange: (path: number[], patch: Partial<FilterRule>) => void;
  onRemove: (path: number[]) => void;
}) {
  const field = getField(rule.field);
  const type = field?.type ?? 'text';
  const ops = operatorsForType(type);
  const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="filter-rule">
      <Select
        name="filter-field"
        aria-label="Field"
        size="sm"
        value={rule.field}
        onValueChange={(v) => onChange(path, { field: v })}
        options={FILTERABLE_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
      />

      <Select
        name="filter-operator"
        aria-label="Operator"
        size="sm"
        value={rule.op}
        onValueChange={(v) => onChange(path, { op: v as FilterRule['op'] })}
        options={ops.map((o) => ({ value: o.op, label: o.label }))}
      />

      {/* Value input(s) — shape depends on the operator's arity. */}
      {operatorTakesNoValue(rule.op) ? null : operatorTakesTwoValues(rule.op) ? (
        <div className="flex items-center gap-1">
          <TextField
            name="filter-from"
            aria-label="From"
            type={inputType}
            size="sm"
            className="w-24"
            value={Array.isArray(rule.value) ? (rule.value[0] ?? '') : ''}
            onChange={(e) =>
              onChange(path, {
                value: [e.target.value, Array.isArray(rule.value) ? (rule.value[1] ?? '') : ''],
              })
            }
          />
          <span className="text-fg-muted text-xs">and</span>
          <TextField
            name="filter-to"
            aria-label="To"
            type={inputType}
            size="sm"
            className="w-24"
            value={Array.isArray(rule.value) ? (rule.value[1] ?? '') : ''}
            onChange={(e) =>
              onChange(path, {
                value: [Array.isArray(rule.value) ? (rule.value[0] ?? '') : '', e.target.value],
              })
            }
          />
        </div>
      ) : operatorTakesList(rule.op) && field?.options ? (
        <Select
          name="filter-values"
          aria-label="Values"
          multiple
          size="sm"
          className="min-w-40"
          value={Array.isArray(rule.value) ? rule.value : []}
          onChange={(e) =>
            onChange(path, {
              value: Array.from(e.target.selectedOptions).map((o) => o.value),
            })
          }
          options={field.options.map((o) => ({ value: o.value, label: o.label }))}
        />
      ) : field?.type === 'enum' && field.options ? (
        <Select
          name="filter-value"
          aria-label="Value"
          size="sm"
          placeholder="Select…"
          value={typeof rule.value === 'string' ? rule.value : ''}
          onValueChange={(v) => onChange(path, { value: v })}
          options={field.options.map((o) => ({ value: o.value, label: o.label }))}
        />
      ) : (
        <TextField
          name="filter-value-text"
          aria-label="Value"
          type={inputType}
          size="sm"
          value={typeof rule.value === 'string' || typeof rule.value === 'number' ? rule.value : ''}
          onChange={(e) => onChange(path, { value: e.target.value })}
        />
      )}

      <IconButton label="Remove rule" icon={<Trash2 size={15} />} onClick={() => onRemove(path)} />
    </div>
  );
}

function GroupBlock({
  group,
  path,
  depth,
  onChange,
  onRemove,
  onAddRule,
  onAddGroup,
  onSetCombinator,
}: {
  group: FilterGroup;
  path: number[];
  depth: number;
  onChange: (path: number[], patch: Partial<FilterRule>) => void;
  onRemove: (path: number[]) => void;
  onAddRule: (path: number[]) => void;
  onAddGroup: (path: number[]) => void;
  onSetCombinator: (path: number[], c: 'and' | 'or') => void;
}) {
  return (
    <div
      className={
        depth === 0
          ? 'space-y-3'
          : 'space-y-3 border-l-2 border-line pl-3 py-2 rounded bg-surface-high'
      }
      data-testid={depth === 0 ? 'filter-root' : 'filter-group'}
    >
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md overflow-hidden border border-line text-xs">
          {(['and', 'or'] as const).map((c) => (
            <Button variant={group.combinator === c ? "primary" : "secondary"} size="sm" key={c} type="button" onClick={() => onSetCombinator(path, c)}>
              {c}
            </Button>
          ))}
        </div>
        <span className="text-xs text-fg-muted">
          {group.combinator === 'and' ? 'Match all of' : 'Match any of'}
        </span>
        {depth > 0 && (
          <IconButton label="Remove group" icon={<X size={15} />} onClick={() => onRemove(path)} />
        )}
      </div>

      {group.rules.map((child, i) =>
        isGroup(child) ? (
          <GroupBlock
            key={i}
            group={child}
            path={[...path, i]}
            depth={depth + 1}
            onChange={onChange}
            onRemove={onRemove}
            onAddRule={onAddRule}
            onAddGroup={onAddGroup}
            onSetCombinator={onSetCombinator}
          />
        ) : (
          <RuleRow key={i} rule={child} path={[...path, i]} onChange={onChange} onRemove={onRemove} />
        ),
      )}

      <div className="flex items-center gap-3 text-xs">
        <Button variant="secondary" size="sm" type="button" onClick={() => onAddRule(path)}>
          <Plus size={13} /> Add condition
        </Button>
        {depth < 3 && (
          <Button variant="secondary" size="sm" type="button" onClick={() => onAddGroup(path)}>
            <FolderPlus size={13} /> Add group
          </Button>
        )}
      </div>
    </div>
  );
}

export default function LeadFilterBuilder({ value, onApply, onClose }: LeadFilterBuilderProps) {
  const [tree, setTree] = useState<FilterGroup>(value && isGroup(value) ? value : emptyFilter());

  const activeCount = countActiveRules(tree);

  return (
    <div className="w-full max-w-2xl bg-surface border border-line rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 text-fg font-semibold">
          <FilterIcon size={16} className="text-primary" />
          Advanced Filters
          {activeCount > 0 && (
            <span className="text-xs bg-primary text-primary-fg rounded-full px-2 py-0.5">{activeCount}</span>
          )}
        </div>
        <IconButton label="Close" icon={<X size={18} />} onClick={onClose} />
      </div>

      <div className="px-4 py-4 overflow-y-auto flex-1">
        {tree.rules.length === 0 ? (
          <div className="text-sm text-fg-muted mb-3">No conditions yet — add one to start filtering.</div>
        ) : null}
        <GroupBlock
          group={tree}
          path={[]}
          depth={0}
          onChange={(p, patch) => setTree((t) => updateRule(t, p, patch))}
          onRemove={(p) => setTree((t) => removeNode(t, p))}
          onAddRule={(p) => setTree((t) => addRule(t, p))}
          onAddGroup={(p) => setTree((t) => addGroup(t, p))}
          onSetCombinator={(p, c) => setTree((t) => setCombinator(t, p, c))}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <Button variant="secondary" size="sm" type="button" onClick={() => setTree(emptyFilter())}>
          Clear all
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={() => onApply(serializeFilter(tree))}>
            Apply{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
