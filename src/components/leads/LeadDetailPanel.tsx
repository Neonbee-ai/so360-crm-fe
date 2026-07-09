import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
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
  MessageSquare,
  Star,
} from 'lucide-react';
import { Lead, Activity as ActivityType } from '../../types/crm';
import { useCRMFormatters } from '../../utils/formatters';

type PanelTab = 'overview' | 'timeline' | 'tasks';

interface LeadDetailPanelProps {
  lead: Lead | null;
  onClose: () => void;
  onNavigate: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
}

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Contacted: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Qualified: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Proposal Sent': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Negotiation: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Converted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  CALL: <Phone size={14} className="text-emerald-400" />,
  MEETING: <Calendar size={14} className="text-blue-400" />,
  EMAIL: <Mail size={14} className="text-amber-400" />,
  NOTE: <FileText size={14} className="text-slate-400" />,
  STATUS_CHANGE: <TrendingUp size={14} className="text-purple-400" />,
  OWNER_CHANGE: <User size={14} className="text-cyan-400" />,
  PROFILE_UPDATE: <Star size={14} className="text-yellow-400" />,
  TASK: <CheckSquare size={14} className="text-indigo-400" />,
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
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-rose-500', text: 'text-rose-400' };
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="mt-0.5 text-slate-500 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
          {label}
        </div>
        <div className="text-sm text-slate-200 break-words">{value}</div>
      </div>
    </div>
  );
}

export function LeadDetailPanel({ lead, onClose, onNavigate, onDelete }: LeadDetailPanelProps) {
  const [tab, setTab] = useState<PanelTab>('overview');
  const formatters = useCRMFormatters();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lead) setTab('overview');
  }, [lead?.id]);

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
  const statusColor = lead ? (STATUS_COLORS[lead.status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20') : '';

  const sortedActivities = lead
    ? [...(lead.activities ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    : [];

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
        className={`fixed right-0 top-0 bottom-0 z-[500] w-[420px] max-w-[95vw] bg-slate-950 border-l border-slate-700/50 shadow-2xl flex flex-col transition-transform duration-250 ease-out ${
          lead ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {!lead ? null : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-slate-800/60">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {contactName ? initials(contactName) : initials(lead.company_name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-50 truncate leading-tight">
                      {lead.company_name}
                    </h2>
                    {contactName && (
                      <p className="text-sm text-slate-400 truncate">{contactName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onNavigate(lead)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Open full page"
                  >
                    <ExternalLink size={15} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
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
                  <span className="text-xs text-slate-500">{lead.source}</span>
                )}
                {score > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/60">
              {lead.contact_email && (
                <a
                  href={`mailto:${lead.contact_email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Mail size={13} />
                  Email
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Phone size={13} />
                  Call
                </a>
              )}
              <button
                onClick={() => onNavigate(lead)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-600/10 hover:bg-blue-600/20 transition-colors"
              >
                View full profile
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800/60">
              {(['overview', 'timeline', 'tasks'] as PanelTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    tab === t
                      ? 'text-blue-400 border-b-2 border-blue-400 -mb-px'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* Overview */}
              {tab === 'overview' && (
                <div className="px-5 py-1">
                  <div className="mb-4 mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Contact Information
                    </p>
                    {lead.contact_email && (
                      <InfoRow
                        icon={<Mail size={14} />}
                        label="Email"
                        value={
                          <a
                            href={`mailto:${lead.contact_email}`}
                            className="text-blue-400 hover:underline"
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
                          <a href={`tel:${lead.phone}`} className="text-slate-200">
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
                            className="text-blue-400 hover:underline truncate block"
                          >
                            {lead.custom_fields.website}
                          </a>
                        }
                      />
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Company Information
                    </p>
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
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Lead Details
                    </p>
                    <InfoRow
                      icon={<User size={14} />}
                      label="Owner"
                      value={lead.owner?.full_name ?? '—'}
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
                    {lead.referred_by && (
                      <InfoRow
                        icon={<User size={14} />}
                        label="Referred By"
                        value={lead.referred_by}
                      />
                    )}
                  </div>

                  {/* Custom fields */}
                  {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Additional Fields
                      </p>
                      {Object.entries(lead.custom_fields)
                        .filter(([key]) => !['city', 'state', 'country', 'industry', 'website', 'tags', 'priority', 'deal_value'].includes(key))
                        .map(([key, val]) => (
                          <InfoRow
                            key={key}
                            icon={<Star size={14} />}
                            label={key.replace(/_/g, ' ')}
                            value={String(val)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              {tab === 'timeline' && (
                <div className="px-5 py-4">
                  {sortedActivities.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-slate-600">
                      <Activity size={32} className="mb-2 opacity-40" />
                      <p className="text-sm">No activity recorded yet</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800" />
                      <div className="space-y-4 pl-10">
                        {sortedActivities.map((activity: ActivityType) => (
                          <div key={activity.id} className="relative">
                            <div className="absolute -left-6 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                              {ACTIVITY_ICONS[activity.type] ?? (
                                <Activity size={10} className="text-slate-400" />
                              )}
                            </div>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-300 capitalize">
                                  {activity.type.replace(/_/g, ' ').toLowerCase()}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatters.formatDate(activity.created_at)}
                                </span>
                              </div>
                              {activity.notes && (
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  {activity.notes}
                                </p>
                              )}
                              {activity.author && (
                                <p className="text-[10px] text-slate-600 mt-1">
                                  by {activity.author.full_name}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tasks */}
              {tab === 'tasks' && (
                <div className="px-5 py-4">
                  <div className="flex flex-col items-center py-10 text-slate-600">
                    <CheckSquare size={32} className="mb-2 opacity-40" />
                    <p className="text-sm">View tasks in the full profile</p>
                    <button
                      onClick={() => onNavigate(lead)}
                      className="mt-3 text-xs text-blue-400 hover:underline"
                    >
                      Open full profile →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {onDelete && (
              <div className="px-5 py-3 border-t border-slate-800/60">
                <button
                  onClick={() => onDelete(lead)}
                  className="w-full text-center text-xs text-rose-500 hover:text-rose-400 transition-colors py-1"
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
