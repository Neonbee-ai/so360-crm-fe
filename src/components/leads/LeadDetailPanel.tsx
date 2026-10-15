import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  User,
  Calendar,
  Tag,
  TrendingUp,
  Activity,
  FileText,
  Clock,
  CheckSquare,
  ChevronRight,
  Star,
  Briefcase,
  Megaphone,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { Card, EmptyState } from '@so360/design-system';
import { Lead, Activity as ActivityType, Deal, Task, TASK_PRIORITY_STYLES, User as CrmUser, SourceTypeOption, CustomFieldDefinition } from '../../types/crm';
import { crmService, settingsApi } from '../../services/crmService';
import { useEntityTimeline } from '../../pages/components/timeline/useEntityTimeline';
import { useCRMFormatters } from '../../utils/formatters';
import { formatFieldValue, visibleMetaEntries, EMPTY_VALUE } from '../../utils/fieldPresentation';

type PanelTab = 'overview' | 'timeline' | 'sales' | 'tasks' | 'marketing' | 'audit';

const PANEL_TABS: Array<{ key: PanelTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Activity' },
  { key: 'sales', label: 'Sales' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'audit', label: 'Audit' },
];

/** Activity types that represent auditable system/state changes (Audit tab). */
const AUDIT_TYPES = new Set(['STATUS_CHANGE', 'STAGE_CHANGE', 'OWNER_CHANGE', 'PROFILE_UPDATE']);

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onNavigate: (lead: Lead) => void;
  onNavigateDeal: (deal: Deal) => void;
  onNavigateTask?: (task: Task) => void;
  onDelete?: (lead: Lead) => void;
}

const INITIAL_ACTIVITY_LOAD = 10;

/** Statuses offered by the Quick View inline selector. Values match the
 *  backend enum on `tasks.status`; labels are the CRM-facing wording. */
const TASK_STATUS_OPTIONS: Array<{ value: Task['status']; label: string }> = [
  { value: 'OPEN', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const TASK_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-surface-high text-fg-subtle',
  IN_PROGRESS: 'bg-info/15 text-primary',
  DONE: 'bg-success/15 text-success',
  ON_HOLD: 'bg-warning/15 text-warning',
  CANCELLED: 'bg-surface-raised text-fg-muted',
};

/** A task counts as overdue when its due date has passed and it is neither
 *  completed nor cancelled. Compared date-only so a task due today is not
 *  flagged part-way through the day. */
function overdueDays(task: Task): number | null {
  if (!task.due_date) return null;
  if (task.status === 'DONE' || task.status === 'CANCELLED') return null;
  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return null;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - dueDay.getTime()) / 86_400_000);
  return diff > 0 ? diff : null;
}

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-info/10 text-primary border-primary/20',
  Contacted: 'bg-info/10 text-info border-info/20',
  Qualified: 'bg-primary/10 text-primary border-primary/20',
  'Proposal Sent': 'bg-warning/10 text-warning border-warning/20',
  Negotiation: 'bg-warning/10 text-warning border-warning/20',
  Converted: 'bg-success/10 text-success border-success/20',
  Lost: 'bg-danger/10 text-danger border-danger/20',
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  CALL: <Phone size={14} className="text-success" />,
  MEETING: <Calendar size={14} className="text-primary" />,
  EMAIL: <Mail size={14} className="text-warning" />,
  NOTE: <FileText size={14} className="text-fg-subtle" />,
  STATUS_CHANGE: <TrendingUp size={14} className="text-primary" />,
  OWNER_CHANGE: <User size={14} className="text-info" />,
  PROFILE_UPDATE: <Star size={14} className="text-warning" />,
  TASK: <CheckSquare size={14} className="text-primary" />,
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function scoreColor(score: number) {
  if (score >= 70) return { bar: 'bg-success', text: 'text-success' };
  if (score >= 40) return { bar: 'bg-warning', text: 'text-warning' };
  return { bar: 'bg-danger', text: 'text-danger' };
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-line last:border-0">
      <div className="mt-0.5 text-fg-muted shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-fg-muted mb-0.5">
          {label}
        </div>
        <div className="text-sm text-fg break-words">{value}</div>
      </div>
    </div>
  );
}

export function LeadDetailPanel({ lead, onClose, onNavigate, onNavigateDeal, onNavigateTask, onDelete }: LeadDetailPanelProps) {
  const [tab, setTab] = useState<PanelTab>('overview');
  const formatters = useCRMFormatters();
  const panelRef = useRef<HTMLDivElement>(null);

  // Lazily-loaded linked records — fetched only when their tab is first opened
  // for the current lead. null = not yet loaded; [] = loaded-but-empty.
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityType[] | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Activity tab reads the SAME server-side unified timeline the full Lead
  // Detail page renders (`useEntityTimeline`). The panel previously called the
  // narrower /activities endpoint, which returns only hand-logged CRM
  // activities — so notes, deals, documents and system events recorded
  // elsewhere never appeared and the panel claimed "No activity recorded yet"
  // while the full profile showed a populated timeline.
  const timeline = useEntityTimeline({
    entityType: 'lead',
    entityId: lead?.id ?? '',
    pageSize: INITIAL_ACTIVITY_LOAD,
  });

  // Lookup data used to resolve relational fields (owner, referred_by, source)
  // to readable names — mirrors LeadDetailPage's resolution so both surfaces
  // stay consistent instead of showing raw ids/codes.
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [partners, setPartners] = useState<Lead[]>([]);
  const [sourceTypes, setSourceTypes] = useState<SourceTypeOption[]>([]);
  // Custom-field values are stored keyed by definition id, so the definitions
  // are what turns a stored UUID key back into the label the admin configured.
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  // The lead this record was merged into, resolved so the drawer can show a name
  // and a working link rather than the bare UUID stored in meta_data.
  const [mergedIntoLead, setMergedIntoLead] = useState<Lead | null>(null);

  const meta = (lead?.custom_fields ?? {}) as Record<string, unknown>;
  const mergedInto = typeof meta.merged_into === 'string' ? meta.merged_into : '';

  useEffect(() => {
    setMergedIntoLead(null);
    if (!mergedInto) return;
    let cancelled = false;
    crmService
      .getLeadById(mergedInto)
      .then((target) => {
        if (!cancelled && target) setMergedIntoLead(target);
      })
      .catch(() => {
        // Target deleted or not visible to this user — fall back to plain text.
      });
    return () => {
      cancelled = true;
    };
  }, [mergedInto]);

  const mergedIntoName =
    mergedIntoLead?.company_name ||
    mergedIntoLead?.contact_name ||
    (mergedIntoLead ? 'Merged record' : 'Merged record (no longer available)');

  const mergedAtDisplay = formatFieldValue(meta.merged_at, {
    formatDate: formatters.formatDate,
  });

  const additionalFields = visibleMetaEntries(meta, {
    formatDate: formatters.formatDate,
    customFieldDefs,
  });

  useEffect(() => {
    if (lead) setTab('overview');
    // Reset linked-record caches when the lead changes.
    setDeals(null);
    setTasks(null);
    setActivities(null);
  }, [lead?.id]);

  // Fetched once per panel mount (not per lead) — these lookup lists are
  // shared across all leads, not lead-specific.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      crmService.getUsers(),
      crmService.getPartners().catch(() => [] as Lead[]),
      settingsApi.sourceTypes.getAll().catch(() => [] as SourceTypeOption[]),
      crmService.getSettings().catch(() => null),
    ]).then(([usersData, partnersData, sourceTypesData, settings]) => {
      if (cancelled) return;
      setUsers(usersData);
      setPartners(partnersData);
      setSourceTypes(sourceTypesData);
      setCustomFieldDefs(settings?.lead_custom_fields ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  // Lazy fetch: load deals/tasks/activities the first time their tab is shown.
  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    if (tab === 'sales' && deals === null && !dealsLoading) {
      setDealsLoading(true);
      crmService
        .getDealsByLeadId(lead.id)
        .then((d) => { if (!cancelled) setDeals(d ?? []); })
        .catch(() => { if (!cancelled) setDeals([]); })
        .finally(() => { if (!cancelled) setDealsLoading(false); });
    }
    if (tab === 'tasks' && tasks === null && !tasksLoading) {
      setTasksLoading(true);
      crmService
        .getTasksByLeadId(lead.id)
        .then((t) => { if (!cancelled) setTasks(t ?? []); })
        .catch(() => { if (!cancelled) setTasks([]); })
        .finally(() => { if (!cancelled) setTasksLoading(false); });
    }
    // Only the Audit tab still needs the raw /activities feed; the Activity
    // tab is served by useEntityTimeline above.
    if (tab === 'audit' && activities === null && !activitiesLoading) {
      setActivitiesLoading(true);
      crmService
        .getActivitiesByLeadIdPaginated(lead.id, INITIAL_ACTIVITY_LOAD, 0)
        .then((r) => { if (!cancelled) setActivities(r?.data ?? []); })
        .catch(() => { if (!cancelled) setActivities([]); })
        .finally(() => { if (!cancelled) setActivitiesLoading(false); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lead?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const contactName = lead
    ? lead.first_name
      ? [lead.first_name, lead.last_name].filter(Boolean).join(' ')
      : (lead.contact_name ?? '')
    : '';

  const score = lead?.auto_score ?? 0;
  const sc = scoreColor(score);
  const statusColor = lead ? (STATUS_COLORS[lead.status] ?? 'bg-fg-muted/10 text-fg-subtle border-line') : '';

  // Resolve owner via the freshly-fetched users list first — lead.owner may
  // carry a stale "Unknown User" placeholder if it was mapped before the
  // shared users cache was warm.
  const ownerName = lead
    ? (users.find((u) => u.id === lead.owner?.id)?.full_name ?? lead.owner?.full_name ?? '—')
    : '—';
  const referredByName = lead?.referred_by
    ? (partners.find((p) => p.id === lead.referred_by)?.company_name ?? '—')
    : undefined;
  const sourceLabel = lead
    ? (sourceTypes.find((o) => o.value === lead.source)?.label ?? lead.source)
    : '';

  const sortedActivities = [...(activities ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Audit trail = the subset of activities that record a system/state change.
  const auditActivities = sortedActivities.filter((a) => AUDIT_TYPES.has(a.type));

  return (
    <>
      {/* Backdrop — only dims, doesn't block grid interaction */}
      <div
        className={`fixed inset-0 z-[450] transition-opacity duration-200 pointer-events-none ${
          lead ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 bottom-0 z-[500] w-[420px] max-w-[95vw] bg-bg border-l border-line shadow-2xl flex flex-col transition-transform duration-250 ease-out ${
          lead ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {!lead ? null : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-line">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-fg flex items-center justify-center text-sm font-bold shrink-0">
                    {contactName ? initials(contactName) : initials(lead.company_name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-fg truncate leading-tight">
                      {lead.company_name}
                    </h2>
                    {contactName && (
                      <p className="text-sm text-fg-subtle truncate">{contactName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={onClose}
                    className="p-2 text-fg-subtle hover:text-fg hover:bg-surface-raised rounded-lg transition-colors"
                    title="Close"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Status + score row */}
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                  {lead.status}
                </span>
                {lead.source && (
                  <span className="text-xs text-fg-muted">{sourceLabel}</span>
                )}
                {score > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className={`h-full ${sc.bar} rounded-full`}
                        style={{ width: `${Math.min(100, score)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${sc.text}`}>{score}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-line">
              {lead.contact_email && (
                <a
                  href={`mailto:${lead.contact_email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-fg-subtle bg-surface-raised hover:bg-line transition-colors"
                >
                  <Mail size={13} />
                  Email
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-fg-subtle bg-surface-raised hover:bg-line transition-colors"
                >
                  <Phone size={13} />
                  Call
                </a>
              )}
              <button
                onClick={() => onNavigate(lead)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                View full profile
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-line overflow-x-auto scrollbar-none">
              {PANEL_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                    tab === t.key
                      ? 'text-primary border-b-2 border-primary -mb-px'
                      : 'text-fg-muted hover:text-fg-subtle'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* Overview */}
              {tab === 'overview' && (
                <div className="px-5 py-1">
                  <Card title="Contact Information" className="mb-3">
                    {lead.contact_email && (
                      <InfoRow
                        icon={<Mail size={14} />}
                        label="Email"
                        value={
                          <a
                            href={`mailto:${lead.contact_email}`}
                            className="text-primary hover:underline"
                          >
                            {lead.contact_email}
                          </a>
                        }
                      />
                    )}
                    {lead.phone && (
                      <InfoRow
                        icon={<Phone size={14} />}
                        label="Phone"
                        value={
                          <a href={`tel:${lead.phone}`} className="text-fg">
                            {lead.phone}
                          </a>
                        }
                      />
                    )}
                    {lead.custom_fields?.website && (
                      <InfoRow
                        icon={<Globe size={14} />}
                        label="Website"
                        value={
                          <a
                            href={lead.custom_fields.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block"
                          >
                            {lead.custom_fields.website}
                          </a>
                        }
                      />
                    )}
                  </Card>

                  <Card title="Company Information" className="mb-3">
                    <InfoRow
                      icon={<Building2 size={14} />}
                      label="Company"
                      value={lead.company_name}
                    />
                    {lead.custom_fields?.industry && (
                      <InfoRow
                        icon={<Tag size={14} />}
                        label="Industry"
                        value={lead.custom_fields.industry}
                      />
                    )}
                    {(lead.custom_fields?.city || lead.custom_fields?.country) && (
                      <InfoRow
                        icon={<MapPin size={14} />}
                        label="Location"
                        value={[lead.custom_fields?.city, lead.custom_fields?.state, lead.custom_fields?.country]
                          .filter(Boolean)
                          .join(', ')}
                      />
                    )}
                  </Card>

                  <Card title="Lead Details" className="mb-3">
                    <InfoRow
                      icon={<User size={14} />}
                      label="Owner"
                      value={ownerName}
                    />
                    <InfoRow
                      icon={<Calendar size={14} />}
                      label="Created"
                      value={formatters.formatDate(lead.created_at)}
                    />
                    {lead.updated_at && (
                      <InfoRow
                        icon={<Clock size={14} />}
                        label="Last Updated"
                        value={formatters.formatDate(lead.updated_at)}
                      />
                    )}
                    {referredByName && (
                      <InfoRow
                        icon={<User size={14} />}
                        label="Referred By"
                        value={referredByName}
                      />
                    )}
                  </Card>

                  {/* Merge provenance — resolved to a name and linked, never the
                      raw UUID/ISO pair that used to fall out of the generic dump. */}
                  {mergedInto && (
                    <Card title="Merge History" className="mb-3">
                      <div className="flex items-start gap-2 py-1.5">
                        <span className="text-fg-muted mt-0.5"><ShieldCheck size={14} /></span>
                        <div className="min-w-0">
                          <p className="text-xs text-fg-muted">Merged Into</p>
                          {mergedIntoLead ? (
                            <button
                              type="button"
                              onClick={() => onNavigate(mergedIntoLead)}
                              className="text-sm font-semibold text-primary hover:text-primary hover:underline text-left transition-colors"
                            >
                              {mergedIntoName}
                            </button>
                          ) : (
                            <p className="text-sm font-semibold text-fg">{mergedIntoName}</p>
                          )}
                        </div>
                      </div>
                      {mergedAtDisplay !== EMPTY_VALUE && (
                        <InfoRow icon={<Clock size={14} />} label="Merged At" value={mergedAtDisplay} />
                      )}
                    </Card>
                  )}

                  {/* Custom fields */}
                  {additionalFields.length > 0 && (
                    <Card title="Additional Fields" className="mb-3">
                      {additionalFields.map(({ key, label, value }) => (
                        <InfoRow key={key} icon={<Star size={14} />} label={label} value={value} />
                      ))}
                    </Card>
                  )}
                </div>
              )}

              {/* Timeline */}
              {tab === 'timeline' && (
                <div className="px-5 py-4">
                  <Card title="Activity">
                  {timeline.loading ? (
                    <div className="flex items-center justify-center py-10 text-fg-muted">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : timeline.error ? (
                    /* A failed load must never masquerade as "no activity". */
                    <EmptyState icon={Activity} title="Couldn't load activity." action={{ label: 'Retry', onClick: () => timeline.refetch() }} />
                  ) : timeline.events.length === 0 ? (
                    <EmptyState icon={Activity} title="No activity recorded yet" />
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-raised" />
                        <div className="divide-y divide-line pl-10">
                          {timeline.events.map((event) => (
                            <div key={event.id} className="relative">
                              <div className="absolute -left-6 w-5 h-5 rounded-full bg-surface border border-line flex items-center justify-center">
                                <Activity size={10} className="text-fg-subtle" />
                              </div>
                              <div className="py-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-semibold text-fg-subtle">
                                    {event.title}
                                  </span>
                                  <span className="text-xs text-fg-muted shrink-0">
                                    {formatters.formatDate(event.created_at)}
                                  </span>
                                </div>
                                {event.description && (
                                  <p className="text-xs text-fg-subtle leading-relaxed">
                                    {event.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {event.module && (
                                    <span className="text-xs text-fg-muted bg-surface-raised rounded px-1.5 py-0.5">
                                      {event.module}
                                    </span>
                                  )}
                                  {event.actor_name && (
                                    <span className="text-xs text-fg-muted">by {event.actor_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Quick View shows a page of the newest events; the full
                          history lives on the lead's own page. */}
                      {timeline.hasMore && (
                        <button
                          onClick={() => onNavigate(lead)}
                          className="w-full mt-4 py-2 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          View full history
                        </button>
                      )}
                    </>
                  )}
                  </Card>
                </div>
              )}

              {/* Sales — linked deals */}
              {tab === 'sales' && (
                <div className="px-5 py-4">
                  <Card title="Deals">
                  {dealsLoading || deals === null ? (
                    <div className="flex items-center justify-center py-10 text-fg-muted">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : deals.length === 0 ? (
                    <EmptyState icon={Briefcase} title="No deals linked to this lead" />
                  ) : (
                    <div className="divide-y divide-line">
                      {deals.map((deal) => (
                        <button
                          key={deal.id}
                          onClick={() => onNavigateDeal(deal)}
                          className="w-full text-left py-3 hover:bg-surface-sunken transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-fg truncate">{deal.name}</span>
                            <span className="text-sm font-bold text-success shrink-0">
                              {formatters.formatCurrency(deal.value ?? 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-fg-muted bg-surface-raised rounded px-1.5 py-0.5">
                              {deal.stage}
                            </span>
                            {deal.expected_close_date && (
                              <span className="text-xs text-fg-muted">
                                Close {formatters.formatDate(deal.expected_close_date)}
                              </span>
                            )}
                            {deal.invoice_number && (
                              <span className="text-xs text-fg-muted">· {deal.invoice_number}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card></div>
              )}

              {/* Tasks — linked tasks */}
              {tab === 'tasks' && (
                <div className="px-5 py-4">
                  <Card title="Tasks">
                  {tasksLoading || tasks === null ? (
                    <div className="flex items-center justify-center py-10 text-fg-muted">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : tasks.length === 0 ? (
                    <EmptyState icon={CheckSquare} title="No tasks for this lead" />
                  ) : (
                    <div className="divide-y divide-line">
                      {taskError && (
                        <p className="text-xs text-danger mb-1">{taskError}</p>
                      )}
                      {tasks.map((task) => {
                        const overdue = overdueDays(task);
                        return (
                          <div
                            key={task.id}
                            role={onNavigateTask ? 'button' : undefined}
                            tabIndex={onNavigateTask ? 0 : undefined}
                            onClick={() => onNavigateTask?.(task)}
                            onKeyDown={(e) => {
                              if (onNavigateTask && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onNavigateTask(task);
                              }
                            }}
                            className={`flex items-start gap-2.5 py-3 transition-colors ${onNavigateTask ? 'cursor-pointer hover:bg-surface-sunken' : ''}`}
                          >
                            <CheckSquare
                              size={14}
                              className={`mt-0.5 shrink-0 ${task.status === 'DONE' ? 'text-success' : 'text-fg-muted'}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm truncate ${task.status === 'DONE' ? 'text-fg-muted line-through' : 'text-fg'}`}>
                                  {task.title}
                                </p>
                                {overdue !== null && (
                                  <span className="shrink-0 text-xs font-semibold text-danger bg-danger/10 border border-danger/20 rounded px-1.5 py-0.5">
                                    Overdue {overdue}d
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {task.due_date && (
                                  <span className={`text-xs ${overdue !== null ? 'text-danger' : 'text-fg-subtle'}`}>
                                    Due {formatters.formatDate(task.due_date)}
                                  </span>
                                )}
                                {task.priority && (
                                  <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                                    TASK_PRIORITY_STYLES[task.priority] ?? 'bg-surface-raised text-fg-subtle'
                                  }`}>
                                    {task.priority}
                                  </span>
                                )}
                                {task.type && (
                                  <span className="text-xs text-fg-muted bg-surface-raised rounded px-1.5 py-0.5">
                                    {String(task.type).replace(/_/g, ' ').toLowerCase()}
                                  </span>
                                )}
                                {task.assigned_to?.full_name && (
                                  <span className="text-xs text-fg-muted">{task.assigned_to.full_name}</span>
                                )}
                              </div>

                              {/* Inline status change — saves immediately, no
                                  navigation. The click is stopped here so
                                  using the selector doesn't also open the task. */}
                              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={task.status}
                                  disabled={taskUpdatingId === task.id}
                                  aria-label={`Status for ${task.title}`}
                                  onChange={async (e) => {
                                    const next = e.target.value as Task['status'];
                                    const previous = task.status;
                                    setTaskError(null);
                                    setTaskUpdatingId(task.id);
                                    // Optimistic: the selector should feel instant.
                                    setTasks((prev) =>
                                      (prev ?? []).map((t) => (t.id === task.id ? { ...t, status: next } : t)),
                                    );
                                    try {
                                      await crmService.updateTask(task.id, { status: next });
                                      // Status changes are timeline events — keep
                                      // the Activity tab in step without a reload.
                                      timeline.refetch();
                                    } catch (err: any) {
                                      setTasks((prev) =>
                                        (prev ?? []).map((t) => (t.id === task.id ? { ...t, status: previous } : t)),
                                      );
                                      setTaskError(err?.message || 'Could not update task status.');
                                    } finally {
                                      setTaskUpdatingId(null);
                                    }
                                  }}
                                  className={`appearance-none text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none disabled:opacity-50 ${
                                    TASK_STATUS_STYLES[task.status] ?? 'bg-surface-raised text-fg-subtle'
                                  }`}
                                >
                                  {TASK_STATUS_OPTIONS.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card></div>
              )}

              {/* Marketing — attribution from the lead record (no fetch) */}
              {tab === 'marketing' && (
                <div className="px-5 py-1">
                  <Card title="Attribution" className="mb-3">
                    <InfoRow icon={<Megaphone size={14} />} label="Source" value={sourceLabel || '—'} />
                    {lead.acquisition_source && (
                      <InfoRow icon={<TrendingUp size={14} />} label="Acquisition Source" value={lead.acquisition_source} />
                    )}
                    {lead.channel && (
                      <InfoRow icon={<Globe size={14} />} label="Channel" value={lead.channel} />
                    )}
                    {lead.custom_fields?.campaign && (
                      <InfoRow icon={<Tag size={14} />} label="Campaign" value={String(lead.custom_fields.campaign)} />
                    )}
                    {referredByName && (
                      <InfoRow icon={<User size={14} />} label="Referred By" value={referredByName} />
                    )}
                    {lead.first_order_at && (
                      <InfoRow icon={<Calendar size={14} />} label="First Order" value={formatters.formatDate(lead.first_order_at)} />
                    )}
                  </Card>
                  {!lead.acquisition_source && !lead.channel && !lead.custom_fields?.campaign && !lead.referred_by && (
                    <p className="text-xs text-fg-muted px-1">No additional marketing attribution recorded.</p>
                  )}
                </div>
              )}

              {/* Audit — system/state-change events */}
              {tab === 'audit' && (
                <div className="px-5 py-4">
                  <Card title="Audit trail">
                  {activitiesLoading || activities === null ? (
                    <div className="flex items-center justify-center py-10 text-fg-muted">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : auditActivities.length === 0 ? (
                    <EmptyState icon={ShieldCheck} title="No audit events recorded" />
                  ) : (
                    <div className="divide-y divide-line">
                      {auditActivities.map((activity: ActivityType) => (
                        <div key={activity.id} className="flex items-start gap-2.5 py-3">
                          <div className="mt-0.5 shrink-0">
                            {ACTIVITY_ICONS[activity.type] ?? <Activity size={12} className="text-fg-subtle" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-fg-subtle capitalize">
                                {activity.type.replace(/_/g, ' ').toLowerCase()}
                              </span>
                              <span className="text-xs text-fg-muted shrink-0">
                                {formatters.formatDate(activity.created_at)}
                              </span>
                            </div>
                            {activity.notes && (
                              <p className="text-xs text-fg-subtle mt-0.5">{activity.notes}</p>
                            )}
                            {activity.author && (
                              <p className="text-xs text-fg-muted mt-0.5">by {activity.author.full_name}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card></div>
              )}
            </div>

            {/* Footer */}
            {onDelete && (
              <div className="px-5 py-3 border-t border-line">
                <button
                  onClick={() => onDelete(lead)}
                  className="w-full text-center text-xs text-danger hover:text-danger transition-colors py-1"
                >
                  Delete this lead
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
