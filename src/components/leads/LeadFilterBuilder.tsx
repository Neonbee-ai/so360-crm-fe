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
      <select
        aria-label="Field"
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={rule.field}
        onChange={(e) => onChange(path, { field: e.target.value })}
      >
        {FILTERABLE_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Operator"
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={rule.op}
        onChange={(e) => onChange(path, { op: e.target.value as FilterRule['op'] })}
      >
        {ops.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Value input(s) — shape depends on the operator's arity. */}
      {operatorTakesNoValue(rule.op) ? null : operatorTakesTwoValues(rule.op) ? (
        <div className="flex items-center gap-1">
          <input
            aria-label="From"
            type={inputType}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={Array.isArray(rule.value) ? (rule.value[0] ?? '') : ''}
            onChange={(e) =>
              onChange(path, {
                value: [e.target.value, Array.isArray(rule.value) ? (rule.value[1] ?? '') : ''],
              })
            }
          />
          <span className="text-slate-500 text-xs">and</span>
          <input
            aria-label="To"
            type={inputType}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={Array.isArray(rule.value) ? (rule.value[1] ?? '') : ''}
            onChange={(e) =>
              onChange(path, {
                value: [Array.isArray(rule.value) ? (rule.value[0] ?? '') : '', e.target.value],
              })
            }
          />
        </div>
      ) : operatorTakesList(rule.op) && field?.options ? (
        <select
          aria-label="Values"
          multiple
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 min-w-[10rem] focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={Array.isArray(rule.value) ? rule.value : []}
          onChange={(e) =>
            onChange(path, {
              value: Array.from(e.target.selectedOptions).map((o) => o.value),
            })
          }
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field?.type === 'enum' && field.options ? (
        <select
          aria-label="Value"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={typeof rule.value === 'string' ? rule.value : ''}
          onChange={(e) => onChange(path, { value: e.target.value })}
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label="Value"
          type={inputType}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={typeof rule.value === 'string' || typeof rule.value === 'number' ? rule.value : ''}
          onChange={(e) => onChange(path, { value: e.target.value })}
        />
      )}

      <button
        type="button"
        aria-label="Remove rule"
        className="text-slate-500 hover:text-rose-400 transition-colors ml-auto"
        onClick={() => onRemove(path)}
      >
        <Trash2 size={15} />
      </button>
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
          : 'space-y-3 border-l-2 border-slate-700 pl-3 py-2 rounded bg-slate-800/40'
      }
      data-testid={depth === 0 ? 'filter-root' : 'filter-group'}
    >
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md overflow-hidden border border-slate-700 text-xs">
          {(['and', 'or'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`px-2.5 py-1 uppercase tracking-wide font-medium transition-colors ${
                group.combinator === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => onSetCombinator(path, c)}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {group.combinator === 'and' ? 'Match all of' : 'Match any of'}
        </span>
        {depth > 0 && (
          <button
            type="button"
            aria-label="Remove group"
            className="text-slate-500 hover:text-rose-400 transition-colors ml-auto"
            onClick={() => onRemove(path)}
          >
            <X size={15} />
          </button>
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
        <button
          type="button"
          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          onClick={() => onAddRule(path)}
        >
          <Plus size={13} /> Add condition
        </button>
        {depth < 3 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => onAddGroup(path)}
          >
            <FolderPlus size={13} /> Add group
          </button>
        )}
      </div>
    </div>
  );
}

export default function LeadFilterBuilder({ value, onApply, onClose }: LeadFilterBuilderProps) {
  const [tree, setTree] = useState<FilterGroup>(value && isGroup(value) ? value : emptyFilter());

  const activeCount = countActiveRules(tree);

  return (
    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <FilterIcon size={16} className="text-blue-400" />
          Advanced Filters
          {activeCount > 0 && (
            <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">{activeCount}</span>
          )}
        </div>
        <button
          type="button"
          aria-label="Close"
          className="text-slate-400 hover:text-slate-200 transition-colors"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-4 py-4 overflow-y-auto flex-1">
        {tree.rules.length === 0 ? (
          <div className="text-sm text-slate-500 mb-3">No conditions yet — add one to start filtering.</div>
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

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
        <button
          type="button"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          onClick={() => setTree(emptyFilter())}
        >
          Clear all
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors"
            onClick={() => onApply(serializeFilter(tree))}
          >
            Apply{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
