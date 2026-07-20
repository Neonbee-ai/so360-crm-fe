import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  ReactNode,
} from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Settings2,
  MoreHorizontal,
  Eye,
  Edit2,
  Copy,
  UserCheck,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Trash2,
  ExternalLink,
  X,
  Check,
  AlignJustify,
  Columns2,
  GripVertical,
  Globe,
  Star,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { Lead, User } from '../../types/crm';
import {
  GridDensity,
  ColumnPreference,
  SortSpec,
  useLeadGridPreferences,
} from '../../hooks/useLeadGridPreferences';
import { useCRMFormatters } from '../../utils/formatters';
import { computeLeadHealth, describeNextFollowUp, describeLastActivity } from './leadIndicators';
import { groupLeadsBy, GROUP_BY_OPTIONS, type GroupByKey } from './leadGrouping';
import { nextFocusIndex, scrollToRevealIndex } from './leadKeyboardNav';
import { useIsNarrow } from './useIsNarrow';
import LeadCardList from './LeadCardList';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridContext {
  users: User[];
  leadStages: { id: string; name: string }[];
  canUpdate: boolean;
  onOwnerChange: (lead: Lead, ownerId: string) => void;
  onStatusChange: (lead: Lead, stageId: string) => void;
  onDelete: (lead: Lead) => void;
  onOpen: (lead: Lead) => void;
  formatDate: (d: string) => string;
  /** Commit an inline cell edit. Optional so existing callers keep working. */
  onInlineEdit?: (lead: Lead, field: string, value: string) => void;
}

/**
 * Columns that support double-click inline editing, mapped to the Lead property
 * the value is read from and written to. Deliberately limited to unambiguous,
 * single-field text columns; ambiguous/derived columns (name split, custom_field
 * backed) are excluded. `updateLead` translates these prop names to the backend.
 */
const EDITABLE_CELLS: Record<string, { prop: keyof Lead; type: 'text' }> = {
  // Plain-text primary column: safe to inline-edit without link/interaction
  // conflicts. email/phone carry mailto:/tel: links and are handled separately
  // in a later pass; custom_field-backed columns (city/state/…) too.
  company: { prop: 'company_name', type: 'text' },
};

interface BulkAction {
  label: string;
  icon: ReactNode;
  variant?: 'danger' | 'default';
  /** Immediate action (export, delete, …). Optional when `options` is provided. */
  onClick?: (ids: string[]) => void;
  /**
   * When present, the button opens a small popover listing these options; picking
   * one calls `onSelect(ids, value)`. Used for owner / status / source pickers.
   * Backward compatible — actions with only `onClick` render as plain buttons.
   */
  options?: Array<{ label: string; value: string }>;
  onSelect?: (ids: string[], value: string) => void;
}

export interface LeadsDataGridProps {
  leads: Lead[];
  isLoading?: boolean;
  context: GridContext;
  onRowClick: (lead: Lead) => void;
  bulkActions?: BulkAction[];
  customFields?: { id: string; label: string }[];
}

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Contacted: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Qualified: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Proposal Sent': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Negotiation: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Converted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-rose-400';
}

function scoreBg(score: number) {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  sortKey?: string;
  render: (lead: Lead, ctx: GridContext, formatDate: (d: string) => string) => ReactNode;
}

const COL_DEFS: ColDef[] = [
  {
    key: 'company',
    label: 'Company',
    defaultWidth: 220,
    minWidth: 140,
    sortKey: 'company_name',
    render: (lead) => (
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-slate-50 truncate leading-tight">
          {lead.company_name}
        </span>
        {lead.type && (
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
            {lead.type}
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'contact',
    label: 'Contact',
    defaultWidth: 180,
    minWidth: 120,
    sortKey: 'contact_name',
    render: (lead) => {
      const name = lead.first_name
        ? [lead.first_name, lead.last_name].filter(Boolean).join(' ')
        : (lead.contact_name ?? '—');
      return (
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0"
            title={name}
          >
            {name !== '—' ? initials(name) : '?'}
          </div>
          <span className="text-slate-300 text-sm truncate">{name}</span>
        </div>
      );
    },
  },
  {
    key: 'email',
    label: 'Email',
    defaultWidth: 200,
    minWidth: 140,
    render: (lead) =>
      lead.contact_email ? (
        <a
          href={`mailto:${lead.contact_email}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors text-sm truncate"
          title={lead.contact_email}
        >
          <Mail size={13} className="shrink-0" />
          <span className="truncate">{lead.contact_email}</span>
        </a>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      ),
  },
  {
    key: 'phone',
    label: 'Phone',
    defaultWidth: 140,
    minWidth: 100,
    render: (lead) =>
      lead.phone ? (
        <a
          href={`tel:${lead.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors text-sm"
        >
          <Phone size={13} className="shrink-0" />
          {lead.phone}
        </a>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      ),
  },
  {
    key: 'status',
    label: 'Status',
    defaultWidth: 140,
    minWidth: 110,
    sortKey: 'status',
    render: (lead, ctx) => {
      const color = statusColor(lead.status);
      const currentStageId =
        ctx.leadStages.find((s) => s.name === lead.status)?.id ||
        (lead as unknown as Record<string, string>).backend_status ||
        '';
      return (
        <div onClick={(e) => e.stopPropagation()}>
          {ctx.canUpdate ? (
            <select
              value={currentStageId}
              onChange={(e) => ctx.onStatusChange(lead, e.target.value)}
              className={`px-2 py-1 rounded-full text-xs font-medium border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${color}`}
            >
              {ctx.leadStages.map((stage) => (
                <option key={stage.id} value={stage.id} className="bg-slate-900 text-slate-300">
                  {stage.name}
                </option>
              ))}
            </select>
          ) : (
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
              {lead.status}
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: 'owner',
    label: 'Owner',
    defaultWidth: 160,
    minWidth: 110,
    sortKey: 'owner',
    render: (lead, ctx) => {
      const ownerName = lead.owner?.full_name ?? '—';
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          {lead.owner?.avatar_url ? (
            <img
              src={lead.owner.avatar_url}
              alt={ownerName}
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
              {ownerName !== '—' ? initials(ownerName) : '?'}
            </div>
          )}
          {ctx.canUpdate ? (
            <select
              value={lead.owner?.id || ''}
              onChange={(e) => ctx.onOwnerChange(lead, e.target.value)}
              className="bg-transparent text-slate-300 text-sm focus:outline-none cursor-pointer hover:text-slate-50 transition-colors truncate max-w-[100px]"
            >
              {ctx.users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-slate-300">
                  {u.full_name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-slate-300 text-sm truncate">{ownerName}</span>
          )}
        </div>
      );
    },
  },
  {
    key: 'source',
    label: 'Source',
    defaultWidth: 130,
    minWidth: 90,
    render: (lead) =>
      lead.source ? (
        <span className="text-slate-300 text-sm truncate">{lead.source}</span>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      ),
  },
  {
    key: 'lead_score',
    label: 'Lead Score',
    defaultWidth: 120,
    minWidth: 90,
    sortKey: 'lead_score',
    render: (lead) => {
      const score = lead.auto_score ?? 0;
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBg(score)} transition-all`}
              style={{ width: `${Math.min(100, score)}%` }}
            />
          </div>
          <span className={`text-xs font-semibold ${scoreColor(score)} w-6 text-right`}>
            {score}
          </span>
        </div>
      );
    },
  },
  {
    key: 'created_at',
    label: 'Created',
    defaultWidth: 140,
    minWidth: 100,
    sortKey: 'created_at',
    render: (lead, _ctx, fmt) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-slate-300 text-xs">{fmt(lead.created_at)}</span>
        {lead.creator && (
          <span className="text-slate-500 text-[10px] truncate">{lead.creator.full_name}</span>
        )}
      </div>
    ),
  },
  {
    key: 'updated_at',
    label: 'Last Updated',
    defaultWidth: 140,
    minWidth: 100,
    sortKey: 'updated_at',
    render: (lead, _ctx, fmt) =>
      lead.updated_at ? (
        <span className="text-slate-300 text-xs">{fmt(lead.updated_at)}</span>
      ) : (
        <span className="text-slate-600 text-xs">—</span>
      ),
  },
  {
    key: 'city',
    label: 'City',
    defaultWidth: 120,
    minWidth: 80,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const city = cf.city ?? cf.City;
      return city ? (
        <span className="text-slate-300 text-sm">{city}</span>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'state',
    label: 'State',
    defaultWidth: 120,
    minWidth: 80,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const state = cf.state ?? cf.State;
      return state ? (
        <span className="text-slate-300 text-sm">{state}</span>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'country',
    label: 'Country',
    defaultWidth: 120,
    minWidth: 80,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const country = cf.country ?? cf.Country;
      return country ? (
        <span className="text-slate-300 text-sm">{country}</span>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'industry',
    label: 'Industry',
    defaultWidth: 140,
    minWidth: 100,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const industry = cf.industry ?? cf.Industry;
      return industry ? (
        <span className="text-slate-300 text-sm">{industry}</span>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'website',
    label: 'Website',
    defaultWidth: 180,
    minWidth: 120,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const site = cf.website ?? cf.Website;
      return site ? (
        <a
          href={site.startsWith('http') ? site : `https://${site}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors text-sm truncate"
        >
          <Globe size={13} className="shrink-0" />
          <span className="truncate">{site}</span>
        </a>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'priority',
    label: 'Priority',
    defaultWidth: 100,
    minWidth: 80,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const priority = cf.priority ?? cf.Priority;
      if (!priority) return <span className="text-slate-600 text-sm">—</span>;
      const colors: Record<string, string> = {
        High: 'text-rose-400',
        Medium: 'text-amber-400',
        Low: 'text-slate-400',
      };
      return (
        <div className="flex items-center gap-1">
          <Star size={12} className={colors[priority] ?? 'text-slate-400'} />
          <span className={`text-sm font-medium ${colors[priority] ?? 'text-slate-300'}`}>
            {priority}
          </span>
        </div>
      );
    },
  },
  {
    key: 'deal_value',
    label: 'Deal Value',
    defaultWidth: 130,
    minWidth: 90,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      const val = cf.deal_value ?? cf['Deal Value'];
      return val != null ? (
        <span className="text-slate-300 text-sm font-medium">
          {Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
        </span>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'tags',
    label: 'Tags',
    defaultWidth: 200,
    minWidth: 120,
    render: (lead) => {
      const cf = lead.custom_fields ?? {};
      // Prefer the first-class tags[] column (written by bulk tagging); fall
      // back to the legacy custom_fields.tags for older records.
      const leadTags = (lead as { tags?: unknown }).tags;
      const tags: string[] = Array.isArray(leadTags)
        ? (leadTags as string[])
        : Array.isArray(cf.tags)
        ? cf.tags
        : cf.tags ? String(cf.tags).split(',').map((t: string) => t.trim()) : [];
      return tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-300"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
              +{tags.length - 3}
            </span>
          )}
        </div>
      ) : (
        <span className="text-slate-600 text-sm">—</span>
      );
    },
  },
  {
    key: 'lead_health',
    label: 'Health',
    defaultWidth: 110,
    minWidth: 90,
    render: (lead) => {
      const h = computeLeadHealth(lead);
      const pill: Record<string, string> = {
        hot: 'bg-emerald-500/15 text-emerald-400',
        warm: 'bg-amber-500/15 text-amber-400',
        cold: 'bg-rose-500/15 text-rose-400',
      };
      const dot: Record<string, string> = {
        hot: 'bg-emerald-400', warm: 'bg-amber-400', cold: 'bg-rose-400',
      };
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${pill[h.level]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot[h.level]}`} />
          {h.label}
        </span>
      );
    },
  },
  {
    key: 'next_follow_up',
    label: 'Next Follow-up',
    defaultWidth: 150,
    minWidth: 110,
    sortKey: 'next_follow_up',
    render: (lead) => {
      const f = describeNextFollowUp(lead);
      if (f.tone === 'none') return <span className="text-slate-600 text-sm">—</span>;
      const tone: Record<string, string> = {
        overdue: 'text-rose-400',
        today: 'text-amber-400',
        tomorrow: 'text-blue-400',
        upcoming: 'text-slate-300',
      };
      return <span className={`text-xs font-medium ${tone[f.tone]}`}>{f.label}</span>;
    },
  },
  {
    key: 'last_activity',
    label: 'Last Activity',
    defaultWidth: 140,
    minWidth: 110,
    sortKey: 'last_activity_at',
    render: (lead) => {
      const a = describeLastActivity(lead);
      return <span className={`text-xs ${a.stale ? 'text-rose-400/80' : 'text-slate-300'}`}>{a.label}</span>;
    },
  },
];

const COL_DEF_MAP = new Map(COL_DEFS.map((c) => [c.key, c]));

// ─── Column Manager ────────────────────────────────────────────────────────────

interface ColumnManagerProps {
  columns: ColumnPreference[];
  onToggle: (key: string, visible: boolean) => void;
  onPin: (key: string, pinned: boolean) => void;
  onReset: () => void;
  onClose: () => void;
  onReorder: (fromKey: string, toKey: string) => void;
}

function ColumnManager({ columns, onToggle, onPin, onReset, onClose, onReorder }: ColumnManagerProps) {
  const dragging = useRef<string | null>(null);

  const manageable = [...columns]
    .filter((c) => c.key !== 'select' && c.key !== 'actions')
    .sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Columns2 size={18} className="text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Customize Columns</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Reset defaults
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-100 transition-colors rounded"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-1">
          {manageable.map((col) => {
            const def = COL_DEF_MAP.get(col.key);
            return (
              <div
                key={col.key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 group cursor-default"
                draggable
                onDragStart={() => { dragging.current = col.key; }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => { if (dragging.current && dragging.current !== col.key) onReorder(dragging.current, col.key); dragging.current = null; }}
              >
                <GripVertical size={14} className="text-slate-600 group-hover:text-slate-400 cursor-grab" />
                <button
                  onClick={() => onToggle(col.key, !col.visible)}
                  className={`w-4 h-4 rounded border transition-colors shrink-0 flex items-center justify-center ${col.visible ? 'bg-blue-600 border-blue-600' : 'border-slate-600 hover:border-slate-400'}`}
                >
                  {col.visible && <Check size={10} className="text-white" />}
                </button>
                <span className="text-sm text-slate-300 flex-1 select-none">
                  {def?.label ?? col.key}
                </span>
                <button
                  onClick={() => onPin(col.key, !col.pinned)}
                  title={col.pinned ? 'Unpin column' : 'Pin column to left'}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${col.pinned ? 'text-blue-400 bg-blue-500/10' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {col.pinned ? 'Pinned' : 'Pin'}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Actions Bar ─────────────────────────────────────────────────────────

interface BulkActionsBarProps {
  count: number;
  actions: BulkAction[];
  selectedIds: string[];
  onClear: () => void;
}

// ─── Inline cell editor ───────────────────────────────────────────────────────

interface InlineCellEditorProps {
  initial: string;
  type: 'text';
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/**
 * A single-cell inline editor. Commits on Enter or blur, cancels on Escape, and
 * only fires onCommit when the value actually changed (no needless write).
 */
function InlineCellEditor({ initial, type, onCommit, onCancel }: InlineCellEditorProps) {
  const [value, setValue] = useState(initial);
  const committed = useRef(false);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    if (value.trim() !== initial.trim()) onCommit(value.trim());
    else onCancel();
  };

  return (
    <input
      autoFocus
      type={type}
      aria-label="Edit cell"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { committed.current = true; onCancel(); }
      }}
      className="w-full bg-slate-800 border border-blue-500 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

function BulkActionsBar({ count, actions, selectedIds, onClear }: BulkActionsBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  return (
    <div data-testid="bulk-actions-bar" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl shadow-black/40">
      <span className="text-sm text-slate-200 font-semibold">{count} selected</span>
      <div className="w-px h-5 bg-slate-600" />
      {actions.map((action) => {
        const hasMenu = !!action.options?.length;
        return (
          <div key={action.label} className="relative" ref={openMenu === action.label ? menuRef : undefined}>
            <button
              onClick={() => {
                if (hasMenu) setOpenMenu((m) => (m === action.label ? null : action.label));
                else action.onClick?.(selectedIds);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                action.variant === 'danger'
                  ? 'text-rose-400 hover:bg-rose-500/10'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {action.icon}
              {action.label}
              {hasMenu && <ChevronDown size={13} className="opacity-60" />}
            </button>
            {hasMenu && openMenu === action.label && (
              <div
                data-testid={`bulk-menu-${action.label}`}
                className="absolute bottom-full mb-2 left-0 z-50 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl py-1 min-w-[180px] max-h-64 overflow-y-auto"
              >
                {action.options!.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { action.onSelect?.(selectedIds, opt.value); setOpenMenu(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="w-px h-5 bg-slate-600" />
      <button
        onClick={onClear}
        className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors rounded-lg hover:bg-slate-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  lead: Lead;
  x: number;
  y: number;
  canUpdate: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onClose: () => void;
  onNavigate: (lead: Lead) => void;
}

function ContextMenu({ lead, x, y, canUpdate, onOpen, onDelete, onClose, onNavigate }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const menuItems = [
    { icon: <Eye size={14} />, label: 'Open detail panel', onClick: onOpen },
    { icon: <ExternalLink size={14} />, label: 'Open full page', onClick: () => { onNavigate(lead); onClose(); } },
    { icon: <Copy size={14} />, label: 'Copy company name', onClick: () => { navigator.clipboard.writeText(lead.company_name).catch(() => {}); onClose(); } },
    { icon: <Mail size={14} />, label: 'Send email', onClick: () => { window.open(`mailto:${lead.contact_email}`); onClose(); } },
    { icon: <Phone size={14} />, label: 'Call', onClick: () => { if (lead.phone) window.open(`tel:${lead.phone}`); onClose(); } },
    ...(canUpdate ? [
      { icon: <Trash2 size={14} />, label: 'Delete', onClick: onDelete, danger: true },
    ] : []),
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[800] bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl py-1.5 min-w-[180px]"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 300) }}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-slate-800 ${
            'danger' in item && item.danger ? 'text-rose-400' : 'text-slate-300'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Density label helper ─────────────────────────────────────────────────────

const DENSITY_CELL_PY: Record<GridDensity, string> = {
  compact: 'py-1.5',
  comfortable: 'py-2.5',
  spacious: 'py-4',
};

// Fixed row heights (px) per density — used only when virtualization is active.
// Kept in sync with DENSITY_CELL_PY so windowing math matches the rendered rows.
const DENSITY_ROW_HEIGHT: Record<GridDensity, number> = {
  compact: 44,
  comfortable: 56,
  spacious: 72,
};

// Below this row count the grid renders every row (identical to the original
// behaviour). At or above it we window the DOM so thousands of rows stay smooth.
const VIRTUALIZE_THRESHOLD = 60;
const VIRTUALIZE_OVERSCAN = 8;

export interface RowWindow {
  virtualize: boolean;
  startIndex: number;
  endIndex: number;
  topPad: number;
  bottomPad: number;
}

/**
 * Pure windowing math for the leads grid. Given the total row count, fixed row
 * height, current scrollTop and viewport height, returns which slice of rows to
 * mount plus the spacer heights that reserve the full scroll extent. Windowing
 * is disabled (all rows) below the threshold or before the viewport is measured.
 * Kept pure and exported so it can be unit-tested without a DOM.
 */
export function computeRowWindow(
  total: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = VIRTUALIZE_OVERSCAN,
  threshold = VIRTUALIZE_THRESHOLD,
): RowWindow {
  const virtualize = total > threshold && viewportHeight > 0 && rowHeight > 0;
  if (!virtualize) {
    return { virtualize: false, startIndex: 0, endIndex: total, topPad: 0, bottomPad: 0 };
  }
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return {
    virtualize: true,
    startIndex,
    endIndex,
    topPad: startIndex * rowHeight,
    bottomPad: (total - endIndex) * rowHeight,
  };
}

// ─── Main Grid ────────────────────────────────────────────────────────────────

export function LeadsDataGrid({
  leads,
  isLoading,
  context,
  onRowClick,
  bulkActions = [],
  customFields = [],
}: LeadsDataGridProps) {
  const formatters = useCRMFormatters();
  const fmt = formatters.formatDate;
  const {
    columns,
    visibleColumns,
    density,
    updateColumn,
    reorderColumns,
    setDensity,
    resetToDefaults,
  } = useLeadGridPreferences();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sorts, setSorts] = useState<SortSpec[]>([]);
  const [contextMenu, setContextMenu] = useState<{ lead: Lead; x: number; y: number } | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  // Group By — display-only transform. 'none' keeps the exact virtualized path.
  const [groupBy, setGroupBy] = useState<GroupByKey>('none');
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Which cell (if any) is being inline-edited.
  const [editing, setEditing] = useState<{ leadId: string; key: string } | null>(null);
  // Keyboard-focused row index (-1 = none). Only active in the ungrouped view.
  const [focusedIndex, setFocusedIndex] = useState(-1);
  // Below the md breakpoint, swap the dense table for a tap-friendly card list.
  const isNarrow = useIsNarrow();

  const resizing = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const draggingHeader = useRef<string | null>(null);
  const densityMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build dynamic custom field columns
  const allColDefs = useMemo(() => {
    const extras: ColDef[] = customFields
      .filter((cf) => !COL_DEF_MAP.has(cf.id))
      .map((cf) => ({
        key: `cf_${cf.id}`,
        label: cf.label,
        defaultWidth: 140,
        minWidth: 90,
        render: (lead: Lead) => {
          const val = lead.custom_fields?.[cf.id] ?? lead.custom_fields?.[cf.label];
          return val != null ? (
            <span className="text-slate-300 text-sm truncate">{String(val)}</span>
          ) : (
            <span className="text-slate-600 text-sm">—</span>
          );
        },
      }));
    return [...COL_DEFS, ...extras];
  }, [customFields]);

  const colDefMap = useMemo(
    () => new Map(allColDefs.map((c) => [c.key, c])),
    [allColDefs],
  );

  // Compute sorted leads
  const sortedLeads = useMemo(() => {
    if (!sorts.length) return leads;
    return [...leads].sort((a, b) => {
      for (const s of sorts) {
        let av: string | number = '';
        let bv: string | number = '';
        switch (s.field) {
          case 'company_name': av = a.company_name; bv = b.company_name; break;
          case 'contact_name':
            av = a.first_name ? [a.first_name, a.last_name].filter(Boolean).join(' ') : (a.contact_name ?? '');
            bv = b.first_name ? [b.first_name, b.last_name].filter(Boolean).join(' ') : (b.contact_name ?? '');
            break;
          case 'status': av = a.status; bv = b.status; break;
          case 'owner': av = a.owner?.full_name ?? ''; bv = b.owner?.full_name ?? ''; break;
          case 'created_at': av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); break;
          case 'updated_at': av = new Date(a.updated_at ?? 0).getTime(); bv = new Date(b.updated_at ?? 0).getTime(); break;
          case 'lead_score': av = a.auto_score ?? 0; bv = b.auto_score ?? 0; break;
          default: return 0;
        }
        const cmp =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv));
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [leads, sorts]);

  const toggleSort = useCallback((field: string) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.field === field);
      if (!existing) return [...prev, { field, direction: 'asc' }];
      if (existing.direction === 'asc') return prev.map((s) => s.field === field ? { ...s, direction: 'desc' } : s);
      return prev.filter((s) => s.field !== field);
    });
  }, []);

  const getSortState = useCallback(
    (field: string) => sorts.find((s) => s.field === field),
    [sorts],
  );

  // Selection
  const allSelected = sortedLeads.length > 0 && sortedLeads.every((l) => selectedIds.has(l.id));
  const someSelected = sortedLeads.some((l) => selectedIds.has(l.id)) && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sortedLeads.map((l) => l.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Column resize
  const startResize = useCallback((key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const col = columns.find((c) => c.key === key);
    if (!col) return;
    resizing.current = { key, startX: e.clientX, startWidth: col.width };

    const onMove = (me: MouseEvent) => {
      if (!resizing.current) return;
      const delta = me.clientX - resizing.current.startX;
      const def = colDefMap.get(key);
      const newWidth = Math.max(def?.minWidth ?? 80, resizing.current.startWidth + delta);
      updateColumn(resizing.current.key, { width: newWidth });
    };
    const onUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [columns, colDefMap, updateColumn]);

  // Density menu close on outside click
  useEffect(() => {
    if (!showDensityMenu) return;
    const handler = (e: MouseEvent) => {
      if (densityMenuRef.current && !densityMenuRef.current.contains(e.target as Node)) {
        setShowDensityMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDensityMenu]);

  // Compute sticky left offsets
  const pinnedCols = visibleColumns.filter((c) => c.pinned);
  const unpinnedCols = visibleColumns.filter((c) => !c.pinned);
  const orderedCols = [...pinnedCols, ...unpinnedCols];

  const colLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let acc = 0;
    for (const col of orderedCols) {
      if (col.pinned) {
        offsets[col.key] = acc;
        acc += col.width;
      }
    }
    return offsets;
  }, [orderedCols]);

  const totalWidth = orderedCols.reduce((s, c) => s + c.width, 0);

  const cellPy = DENSITY_CELL_PY[density];

  // ── DOM windowing (dependency-free virtualization) ─────────────────────────
  // Only rows within the visible viewport (plus a small overscan) are mounted;
  // spacer divs above/below reserve the full scroll height. Activates only past
  // VIRTUALIZE_THRESHOLD so small lists render exactly as before.
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const rowH = DENSITY_ROW_HEIGHT[density];
  const { virtualize, startIndex, endIndex, topPad, bottomPad } = computeRowWindow(
    sortedLeads.length,
    rowH,
    scrollTop,
    viewportH,
  );
  const visibleRows = virtualize ? sortedLeads.slice(startIndex, endIndex) : sortedLeads;

  // Grouping is a pure view over the sorted list. Only computed when active so
  // the ungrouped path pays nothing.
  const grouped = groupBy !== 'none';
  const groups = useMemo(
    () => (grouped ? groupLeadsBy(sortedLeads, groupBy) : []),
    [grouped, sortedLeads, groupBy],
  );

  // Keyboard navigation over the (ungrouped) row list. Arrow/Home/End move the
  // focus ring and keep it in view; Enter opens the focused lead, Space toggles
  // its selection, Escape clears focus. Typing inside an editor is never hijacked.
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (grouped || sortedLeads.length === 0) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const nav = nextFocusIndex(focusedIndex, e.key, sortedLeads.length);
    if (nav !== null) {
      e.preventDefault();
      setFocusedIndex(nav);
      const el = containerRef.current;
      if (el) {
        const next = scrollToRevealIndex(nav, rowH, el.scrollTop, el.clientHeight);
        if (next !== el.scrollTop) { el.scrollTop = next; setScrollTop(next); }
      }
      return;
    }

    if (focusedIndex < 0 || focusedIndex >= sortedLeads.length) return;
    const lead = sortedLeads[focusedIndex];
    if (e.key === 'Enter') { e.preventDefault(); onRowClick(lead); }
    else if (e.key === ' ') { e.preventDefault(); toggleSelect(lead.id); }
    else if (e.key === 'Escape') { e.preventDefault(); setFocusedIndex(-1); }
  }, [grouped, sortedLeads, focusedIndex, rowH, onRowClick, toggleSelect]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!showGroupMenu) return;
    const handler = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupMenu]);

  // Reset the keyboard focus when the underlying data or grouping changes, so a
  // stale index can never point past the end of the list.
  useEffect(() => { setFocusedIndex(-1); }, [leads, groupBy]);

  // A single lead row, shared by the virtualized (ungrouped) and grouped paths so
  // markup never diverges. In grouped mode `virtualize` is false, so rows render
  // at natural height exactly like a small ungrouped list.
  const renderRow = (lead: Lead, absIndex = -1) => {
    const isSelected = selectedIds.has(lead.id);
    const isHovered = hoveredRowId === lead.id;
    const isFocused = absIndex >= 0 && absIndex === focusedIndex;
    return (
      <div
        key={lead.id}
        className={`flex border-b border-slate-800/60 cursor-pointer transition-colors group/row ${
          virtualize && !grouped ? 'overflow-hidden' : ''
        } ${
          isFocused ? 'ring-1 ring-inset ring-blue-500/70 bg-blue-600/10' : isSelected ? 'bg-blue-600/8' : isHovered ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'
        }`}
        style={{ minWidth: `${totalWidth}px`, ...(virtualize && !grouped ? { height: rowH } : {}) }}
        onClick={() => onRowClick(lead)}
        onMouseEnter={() => setHoveredRowId(lead.id)}
        onMouseLeave={() => setHoveredRowId(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ lead, x: e.clientX, y: e.clientY });
        }}
      >
        {orderedCols.map((col) => {
          const def = colDefMap.get(col.key);
          const isSticky = col.pinned;

          if (col.key === 'select') {
            return (
              <div
                key="select"
                className={`flex items-center justify-center shrink-0 sticky z-10 ${cellPy} ${
                  isSelected ? 'bg-blue-600/10' : isHovered ? 'bg-slate-800/50' : 'bg-slate-950'
                }`}
                style={{ width: col.width, left: colLeftOffsets['select'] }}
                onClick={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}
              >
                <div
                  className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-600 hover:border-slate-400'
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
              </div>
            );
          }

          if (col.key === 'actions') {
            return (
              <div
                key="actions"
                className={`flex items-center justify-center shrink-0 ${cellPy}`}
                style={{ width: col.width }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({ lead, x: e.clientX, y: e.clientY });
                  }}
                  className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover/row:opacity-100"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            );
          }

          const editable = EDITABLE_CELLS[col.key];
          const canEditCell = editable && context.canUpdate && !!context.onInlineEdit;
          const isEditingCell = canEditCell && editing?.leadId === lead.id && editing?.key === col.key;

          return (
            <div
              key={col.key}
              className={`flex items-center shrink-0 px-3 overflow-hidden ${cellPy} ${
                canEditCell ? 'cursor-text' : ''
              } ${
                isSticky
                  ? `sticky z-10 ${isSelected ? 'bg-blue-600/10' : isHovered ? 'bg-slate-800/50' : 'bg-slate-950'}`
                  : ''
              }`}
              style={{
                width: col.width,
                ...(isSticky ? { left: colLeftOffsets[col.key] } : {}),
              }}
              onClick={canEditCell ? (e) => e.stopPropagation() : undefined}
              onDoubleClick={
                canEditCell
                  ? (e) => { e.stopPropagation(); setEditing({ leadId: lead.id, key: col.key }); }
                  : undefined
              }
            >
              {isEditingCell ? (
                <InlineCellEditor
                  initial={String(lead[editable!.prop] ?? '')}
                  type={editable!.type}
                  onCommit={(value) => {
                    context.onInlineEdit?.(lead, editable!.prop as string, value);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : def ? def.render(lead, context, fmt) : null}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 bg-slate-900/80">
          <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-700/30">
            <div className="h-4 w-48 bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-36 bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm text-slate-400">
          {sortedLeads.length} lead{sortedLeads.length !== 1 ? 's' : ''}
          {sorts.length > 0 && (
            <button
              onClick={() => setSorts([])}
              className="ml-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Clear sort
            </button>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* Group by */}
          <div className="relative" ref={groupMenuRef}>
            <button
              onClick={() => setShowGroupMenu((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                grouped
                  ? 'text-blue-300 bg-blue-500/10 border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-700/50'
              }`}
              title="Group by"
            >
              <Layers size={14} />
              <span>{GROUP_BY_OPTIONS.find((o) => o.key === groupBy)?.label ?? 'Group'}</span>
            </button>
            {showGroupMenu && (
              <div
                data-testid="group-by-menu"
                className="absolute right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl py-1 min-w-[160px]"
              >
                {GROUP_BY_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => { setGroupBy(o.key); setCollapsedGroups(new Set()); setShowGroupMenu(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                      groupBy === o.key ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {groupBy === o.key && <Check size={12} />}
                    <span className={groupBy === o.key ? '' : 'ml-4'}>{o.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Density picker */}
          <div className="relative" ref={densityMenuRef}>
            <button
              onClick={() => setShowDensityMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
              title="Row density"
            >
              <AlignJustify size={14} />
              <span className="capitalize">{density}</span>
            </button>
            {showDensityMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl py-1 min-w-[140px]">
                {(['compact', 'comfortable', 'spacious'] as GridDensity[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDensity(d); setShowDensityMenu(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors capitalize ${
                      density === d ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {density === d && <Check size={12} />}
                    <span className={density === d ? '' : 'ml-4'}>{d}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column manager */}
          <button
            onClick={() => setShowColumnManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-700/50"
            title="Customize columns"
          >
            <Settings2 size={14} />
            Columns
          </button>
        </div>
      </div>

      {/* Grid (desktop) / card list (narrow) */}
      {isNarrow ? (
        <LeadCardList
          leads={sortedLeads}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onRowClick={onRowClick}
        />
      ) : (
      <div
        ref={containerRef}
        className="rounded-xl border border-slate-700/50 overflow-auto bg-slate-950"
        style={{ maxHeight: 'calc(100vh - 320px)' }}
        onContextMenu={(e) => e.preventDefault()}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        tabIndex={0}
        role="grid"
        aria-label="Leads"
        onKeyDown={handleGridKeyDown}
      >
        <div style={{ minWidth: `${totalWidth}px` }}>
          {/* Header */}
          <div
            className="flex sticky top-0 z-20 bg-slate-900 border-b border-slate-700/50"
            style={{ minWidth: `${totalWidth}px` }}
          >
            {orderedCols.map((col) => {
              const def = colDefMap.get(col.key);
              const sortKey = def?.sortKey;
              const sortState = sortKey ? getSortState(sortKey) : undefined;

              if (col.key === 'select') {
                return (
                  <div
                    key="select"
                    className="flex items-center justify-center shrink-0 sticky bg-slate-900 z-30"
                    style={{ width: col.width, left: colLeftOffsets['select'] }}
                  >
                    <button
                      data-testid="bulk-select-all"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-100 transition-colors"
                    >
                      {allSelected ? (
                        <CheckSquare2 size={16} className="text-blue-400" />
                      ) : someSelected ? (
                        <MinusSquare size={16} className="text-blue-400" />
                      ) : (
                        <Square2 size={16} />
                      )}
                    </button>
                  </div>
                );
              }

              if (col.key === 'actions') {
                return (
                  <div key="actions" className="shrink-0" style={{ width: col.width }} />
                );
              }

              return (
                <div
                  key={col.key}
                  className={`relative flex items-center group px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none shrink-0 py-3 ${
                    col.pinned ? 'sticky z-30 bg-slate-900' : ''
                  }`}
                  style={{
                    width: col.width,
                    ...(col.pinned ? { left: colLeftOffsets[col.key] } : {}),
                  }}
                  draggable={col.key !== 'select' && col.key !== 'actions'}
                  onDragStart={() => { draggingHeader.current = col.key; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingHeader.current && draggingHeader.current !== col.key) {
                      reorderColumns(draggingHeader.current, col.key);
                    }
                    draggingHeader.current = null;
                  }}
                >
                  {sortKey ? (
                    <button
                      onClick={() => toggleSort(sortKey)}
                      className="flex items-center gap-1 hover:text-slate-100 transition-colors"
                    >
                      {def?.label ?? col.key}
                      {sortState ? (
                        sortState.direction === 'asc' ? (
                          <ChevronUp size={12} className="text-blue-400" />
                        ) : (
                          <ChevronDown size={12} className="text-blue-400" />
                        )
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  ) : (
                    <span>{def?.label ?? col.key}</span>
                  )}

                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-blue-500/30 rounded"
                    onMouseDown={(e) => startResize(col.key, e)}
                  />
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {sortedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <TrendingUp size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No leads found</p>
            </div>
          ) : grouped ? (
            /* Grouped view — collapsible headers, virtualization disabled. */
            <>
              {groups.map((g) => {
                const isCollapsed = collapsedGroups.has(g.key);
                return (
                  <div key={g.key} data-testid={`lead-group-${g.key}`}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.key)}
                      className="flex items-center gap-2 w-full sticky left-0 px-3 py-2 bg-slate-900/80 border-b border-slate-700/50 text-sm text-slate-200 hover:bg-slate-800/60 transition-colors"
                      style={{ minWidth: `${totalWidth}px` }}
                    >
                      {isCollapsed ? (
                        <ChevronDown size={14} className="-rotate-90 text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                      <span className="font-semibold">{g.label}</span>
                      <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
                        {g.count}
                      </span>
                    </button>
                    {!isCollapsed && g.leads.map((l) => renderRow(l))}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {topPad > 0 && <div style={{ height: topPad }} aria-hidden="true" />}
              {visibleRows.map((lead, i) => renderRow(lead, (virtualize ? startIndex : 0) + i))}
              {bottomPad > 0 && <div style={{ height: bottomPad }} aria-hidden="true" />}
            </>
          )}
        </div>
      </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          actions={bulkActions}
          selectedIds={Array.from(selectedIds)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          lead={contextMenu.lead}
          x={contextMenu.x}
          y={contextMenu.y}
          canUpdate={context.canUpdate}
          onOpen={() => { onRowClick(contextMenu.lead); setContextMenu(null); }}
          onDelete={() => { context.onDelete(contextMenu.lead); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
          onNavigate={context.onOpen}
        />
      )}

      {/* Column manager modal */}
      {showColumnManager && (
        <ColumnManager
          columns={columns}
          onToggle={(key, visible) => updateColumn(key, { visible })}
          onPin={(key, pinned) => updateColumn(key, { pinned })}
          onReset={resetToDefaults}
          onClose={() => setShowColumnManager(false)}
          onReorder={reorderColumns}
        />
      )}
    </>
  );
}

// ─── Checkbox icon helpers (avoid extra deps) ─────────────────────────────────

function CheckSquare2({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function MinusSquare({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function Square2({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}
