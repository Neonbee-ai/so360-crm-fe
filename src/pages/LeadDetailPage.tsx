import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { eventBus } from '@so360/event-bus';
import { useShell, useActivity, useShellBridge, useCurrentEntity } from '@so360/shell-context';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronLeft, Mail, Phone, Building2,
    Calendar, Tag, Clock, Plus,
    LayoutDashboard, Briefcase, CheckCircle2,
    Loader2, ExternalLink, MessageSquare, Users, FileText,
    DollarSign, PieChart, Edit2, Trash2, X,
    File, Download, UploadCloud, FileIcon, Eye, Package, ShieldCheck, Search, Settings2
} from 'lucide-react';
import { crmService, activitiesApi, settingsApi } from '../services/crmService';
import { PartnerSearchDropdown } from '../components/common/PartnerSearchDropdown';
import { useCRMFormatters } from '../utils/formatters';
import { isTaskLocked, TASK_LOCKED_HINT } from '../utils/taskUtils';
import { validateEmailRequired } from '../utils/emailValidation';
import { validatePhone } from '../utils/phoneValidation';
import { validateFirstNameRequired, validateLastName } from '../utils/leadFieldValidation';
import { describeApiError } from '../utils/apiErrorMessage';
import { Lead, Deal, Task, Activity, ActivityType, CustomFieldDefinition, LeadScoringRule, User, Attachment, Note, SourceTypeOption } from '../types/crm';
import { toast } from '@so360/design-system';
import { ClickToCallButton } from '../components/common/ClickToCallButton';
import { Trophy, Zap, Info, TrendingUp, RefreshCw } from 'lucide-react';
import CreateDealModal from './components/CreateDealModal';
import TaskModal from './components/TaskModal';
import DetailBackLink from '../components/common/DetailBackLink';
import CustomerDetailsPanel from '../components/CustomerDetailsPanel';
import { LeadJourneyStepper } from '../components/LeadJourneyStepper';
import LeadProductsTab from './components/LeadProductsTab';
import ActivityHistoryDrawer from './components/ActivityHistoryDrawer';
import NeuraAiSummaryCard from './components/NeuraAiSummaryCard';
import CustomerFeedbackTab from './components/CustomerFeedbackTab';
import CallsTab, { LogCallModal } from './components/CallsTab';
import AuditHistoryTab from './components/AuditHistoryTab';
import QuickActionBar from './components/QuickActionBar';
import LeadLayoutSettingsPanel from './components/LeadLayoutSettingsPanel';
import { useLeadDetailLayoutPreferences } from '../hooks/useLeadDetailLayoutPreferences';
import StakeholdersTab from '../components/stakeholders/StakeholdersTab';
import EmailsTab from './components/EmailsTab';
import MeetingsTab from './components/MeetingsTab';
import MeetingModal from './components/MeetingModal';
import { useEntityTimeline } from './components/timeline/useEntityTimeline';
import TimelineEventCard from './components/timeline/TimelineEventCard';
import TimelineSummaryBanner from './components/timeline/TimelineSummaryBanner';
import NoteEditor from '../components/notes/NoteEditor';
import NoteContent from '../components/notes/NoteContent';
import NoteReplyComposer from '../components/notes/NoteReplyComposer';
import { ExecutiveSummaryPanel } from '../components/ExecutiveSummaryPanel';

type TabType = 'activity' | 'notes' | 'tasks' | 'documents' | 'products' | 'feedback' | 'calls' | 'audit' | 'stakeholders' | 'emails' | 'meetings';

interface TabCounts {
    tasks: number;
    documents: number;
    products: number;
}

// Task 5 (Customizable Layout): the tab bar is now data-driven off
// useLeadDetailLayoutPreferences() (order/visibility) instead of a fixed
// JSX sequence — this config maps each section key to its icon/label.
const TAB_CONFIG: Record<string, { icon: React.ReactNode; label: (counts: TabCounts) => React.ReactNode }> = {
    activity: { icon: <MessageSquare size={14} />, label: () => 'Activity' },
    notes: { icon: <FileText size={14} />, label: () => 'Notes' },
    tasks: { icon: <CheckCircle2 size={14} />, label: (c) => `Tasks (${c.tasks})` },
    documents: { icon: <File size={14} />, label: (c) => `Documents (${c.documents})` },
    products: { icon: <Package size={14} />, label: (c) => `Products ${c.products > 0 ? `(${c.products})` : ''}` },
    feedback: { icon: <MessageSquare size={14} />, label: () => 'Feedback' },
    calls: { icon: <Phone size={14} />, label: () => 'Calls' },
    audit: { icon: <ShieldCheck size={14} />, label: () => 'Audit History' },
    stakeholders: { icon: <Users size={14} />, label: () => 'Stakeholders' },
    emails: { icon: <Mail size={14} />, label: () => 'Emails' },
    meetings: { icon: <Calendar size={14} />, label: () => 'Meetings' },
};

// Tiptap emits '<p></p>' for an empty editor rather than '', so a plain
// .trim() check isn't enough — strip tags first to see if there's real content.
const isNoteContentEmpty = (html: string): boolean => html.replace(/<[^>]*>/g, '').trim().length === 0;

const getLeadDisplayName = (lead: Pick<Lead, 'first_name' | 'last_name' | 'contact_name'>): string =>
    lead.first_name
        ? [lead.first_name, lead.last_name].filter(Boolean).join(' ')
        : (lead.contact_name || '');

const isTaskOverdue = (dueDate: string): boolean => {
    const due = new Date(dueDate);
    const today = new Date();
    // Normalize to start of day for comparison
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return due < today;
};

// Notify other MFEs (e.g. the Documents module) that a CRM document changed so
// they can refresh their linked-document views. Uses the shared event bus with a
// window CustomEvent fallback for environments where the bus is unavailable.
export function publishLeadDocumentsChanged(leadId: string) {
    const payload = { source: 'crm', entity_type: 'crm:lead', entity_id: leadId };
    try {
        eventBus.publish('documents:changed', payload);
    } catch {
        window.dispatchEvent(new CustomEvent('documents:changed', { detail: payload }));
    }
}

// Open a document: DMS-backed docs resolve a (signed) URL on demand; legacy docs
// fall back to their stored `url`.
export async function openLeadDocument(doc: Attachment) {
    let url = doc.url;
    if (doc.dmsDocumentId) {
        url = await crmService.getDocumentDownloadUrl(doc.id);
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

const LeadDetailPage = () => {
    const formatters = useCRMFormatters();
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { recordActivity } = useActivity();
    const { isModuleEnabled } = useShell();
    const { setCurrentEntity } = useCurrentEntity();
    const shell = useShellBridge();
    const canCreateDeal = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('deals.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:deals:create') ?? true);
    const canPromoteLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.convert') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:promote') ?? true);
    const canQualifyLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.update') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:qualify') ?? true);
    const canConvertLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.convert') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:convert') ?? true);
    // Destructive action — gate on the delete permission, fail closed. The backend
    // already enforces leads.delete; this stops offering a control the user can't use.
    const canDeleteLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.delete') ?? false);
    const canUseNeuraAi = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('submodule:crm:neura_ai_copilot') ?? false);
    const isDailyStoreEnabled = isModuleEnabled('dailystore');
    const isInboxEnabled = isModuleEnabled('inbox');
    const isCustomerDetailRoute = location.pathname.includes('/customers/');
    const backLabel = isCustomerDetailRoute ? 'Back to Customers' : 'Back to Leads';
    const backRoute = isCustomerDetailRoute ? '/crm/customers' : '/crm/leads';
    const [lead, setLead] = useState<Lead | null>(null);
    const [associatedDeals, setAssociatedDeals] = useState<Deal[]>([]);
    const [associatedTasks, setAssociatedTasks] = useState<Task[]>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [scoringRules, setScoringRules] = useState<LeadScoringRule[]>([]);
    const [scoreCategories, setScoreCategories] = useState<import('../types/crm').ScoreCategory[]>([]);
    const [isRecalculatingScore, setIsRecalculatingScore] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('activity');
    const [infoTab, setInfoTab] = useState<'profile' | 'additional' | 'business'>('profile');
    const [isLoading, setIsLoading] = useState(true);
    /** True when the lead fetch returned 403 — distinct from the lead not existing. */
    const [accessDenied, setAccessDenied] = useState(false);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    // Editing a lead ran the same fields through no validation at all, so a
    // name or phone rejected by Create Lead could still be saved from here.
    const [editErrors, setEditErrors] = useState<Record<string, string | null>>({});
    const [isChangingOwner, setIsChangingOwner] = useState(false);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const [isChangingStage, setIsChangingStage] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [isCreatingDeal, setIsCreatingDeal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [leadStages, setLeadStages] = useState<{ id: string, name: string }[]>([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    // Tiptap only seeds `content` on initial mount — bump this key to force a
    // fresh editor instance (and thus a visibly cleared editor) after saving.
    const [noteEditorKey, setNoteEditorKey] = useState(0);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteContent, setEditingNoteContent] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [partners, setPartners] = useState<Lead[]>([]);
    const [sourceTypes, setSourceTypes] = useState<SourceTypeOption[]>([]);
    const [productCount, setProductCount] = useState(0);
    const [productValue, setProductValue] = useState(0);
    const [activityTotal, setActivityTotal] = useState(0);
    const [showActivityDrawer, setShowActivityDrawer] = useState(false);
    // Quick actions open their own surface in place. They used to switch the
    // workspace tab and scroll to a form inside it, which read as a page jump
    // and — because the "open the form" flag was already true — did nothing at
    // all on the second click.
    const [isSchedulingMeeting, setIsSchedulingMeeting] = useState(false);
    const [isLoggingCall, setIsLoggingCall] = useState(false);
    // Bumped after a quick action saves, so the matching tab reloads when next shown.
    const [callsRefreshKey, setCallsRefreshKey] = useState(0);
    const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0);
    const [showLayoutSettings, setShowLayoutSettings] = useState(false);
    const [expandedStatusDropdown, setExpandedStatusDropdown] = useState<string | null>(null);
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

    // A reminder is a pointer to a task that already exists in the list below —
    // clicking it focuses that task instead of opening a separate record.
    const focusTaskInList = useCallback((taskId: string) => {
        setHighlightedTaskId(taskId);
        const el = document.getElementById(`task-card-${taskId}`);
        el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
            setHighlightedTaskId(current => (current === taskId ? null : current));
        }, 2500);
    }, []);
    const layoutPrefs = useLeadDetailLayoutPreferences();

    // Quick actions live at the top of the page; the workspace they drive sits
    // well below the fold. Switching the tab alone therefore looked like the
    // button did nothing — every quick action now scrolls the workspace into
    // view and, where a composer exists, opens/focuses it.
    const workspaceRef = useRef<HTMLDivElement>(null);
    const noteComposerRef = useRef<HTMLDivElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);

    const openWorkspaceTab = useCallback((tab: TabType) => {
        setActiveTab(tab);
        window.requestAnimationFrame(() => {
            workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, []);

    // Task 4 (Customer Timeline): unified server-side timeline, shared between
    // the inline preview below and ActivityHistoryDrawer.tsx.
    const entityTimeline = useEntityTimeline({ entityType: 'lead', entityId: id, pageSize: 7 });

    // Task 3 — communication-wide search: client-side merge across data
    // already loaded at page level (notes/tasks/deals). Per-lead volumes are
    // small, so no dedicated backend endpoint. Emails/meetings/calls are
    // fetched lazily inside their own tabs (not lifted here), so they are
    // out of scope for this search — a deliberate, documented scope
    // reduction rather than a silent gap.
    const [commSearchQuery, setCommSearchQuery] = useState('');
    const commSearchResults = useMemo(() => {
        const q = commSearchQuery.trim().toLowerCase();
        if (!q || !lead) return [];
        type Result = { id: string; kind: string; title: string; date: string; tab: TabType };
        const results: Result[] = [];
        (lead.notes || []).forEach((n) => {
            const text = n.content.replace(/<[^>]*>/g, '');
            if (text.toLowerCase().includes(q)) {
                results.push({ id: `note:${n.id}`, kind: 'Note', title: text.slice(0, 80), date: n.created_at, tab: 'notes' });
            }
        });
        associatedTasks.forEach((t) => {
            if (t.title.toLowerCase().includes(q)) {
                results.push({ id: `task:${t.id}`, kind: 'Task', title: t.title, date: t.due_date || t.created_at, tab: 'tasks' });
            }
        });
        associatedDeals.forEach((d) => {
            if (d.name.toLowerCase().includes(q)) {
                results.push({ id: `deal:${d.id}`, kind: 'Deal', title: d.name, date: d.created_at || d.expected_close_date, tab: 'activity' });
            }
        });
        return results.slice(0, 20);
    }, [commSearchQuery, lead, associatedTasks, associatedDeals]);

    const INITIAL_ACTIVITY_LOAD = 7;

    const fetchLeadData = useCallback(async () => {
        try {
            // Only the lead itself is critical. Everything else is supporting
            // detail and degrades to an empty value.
            //
            // These nine calls used to share one Promise.all with no per-call
            // catch, so a single 403 on any ONE of them — permitted or not —
            // rejected the whole batch, left `lead` null, and rendered
            // "Lead not found." A user who could read the lead perfectly well was
            // told it did not exist because, say, they lacked partner access.
            const [leadData, [dealsData, tasksData, settingsData, usersData, activitiesResult, partnersData, fetchedSourceTypes, documentsData]] = await Promise.all([
                // Critical: a failure here is the page's failure.
                crmService.getLeadById(id),
                // Supporting detail: each degrades independently.
                Promise.all([
                    crmService.getDealsByLeadId(id).catch(() => [] as any[]),
                    crmService.getTasksByLeadId(id).catch(() => [] as any[]),
                    crmService.getSettings().catch(() => ({} as any)),
                    crmService.getUsers().catch(() => [] as any[]),
                    crmService.getActivitiesByLeadIdPaginated(id, INITIAL_ACTIVITY_LOAD, 0)
                        .catch(() => ({ data: [] as any[], total: 0 })),
                    crmService.getPartners().catch(() => [] as any[]),
                    settingsApi.sourceTypes.getAll().catch(() => [] as any[]),
                    crmService.getDocumentsByLeadId(id).catch(() => [] as any[]),
                ]),
            ]);

            setAccessDenied(false);
            setLead(leadData || null);
            if (leadData) {
                setLead({ ...leadData, activities: activitiesResult.data, documents: documentsData });
            }
            setActivityTotal(activitiesResult.total);
            setAssociatedDeals(dealsData);
            setAssociatedTasks(tasksData);
            setCustomFieldDefs(settingsData?.lead_custom_fields || []);
            setScoringRules(settingsData.lead_scoring || []);
            setScoreCategories(settingsData.score_categories || []);
            setLeadStages(settingsData.lead_stages || []);
            setAllUsers(usersData);
            setPartners(partnersData);
            setSourceTypes(fetchedSourceTypes);
        } catch (error) {
            console.error('Failed to fetch lead data', error);
            // Report a permission failure as a permission failure. Reusing the
            // "not found" state for this sent users hunting for a deleted record
            // instead of asking an administrator for access.
            setAccessDenied((error as { status?: number })?.status === 403);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    const handleRecalculateScore = useCallback(async () => {
        if (!lead || isRecalculatingScore) return;
        setIsRecalculatingScore(true);
        try {
            await settingsApi.scoringRules.recalculate();
        } catch {
            // recalculate failure is non-critical; still refresh so UI shows latest stored score
        }
        try {
            await fetchLeadData();
        } catch {
            // fetchLeadData handles its own display errors
        } finally {
            setIsRecalculatingScore(false);
        }
    }, [lead, isRecalculatingScore, fetchLeadData]);

    useEffect(() => {
        fetchLeadData();
    }, [fetchLeadData]);

    // Publish the lead on screen to the shell so the global Neura AI panel can
    // scope its answers to it — cleared on unmount so a stale entity never
    // outlives this page (e.g. navigating to a non-detail route).
    useEffect(() => {
        if (!lead) return;
        setCurrentEntity({
            module: 'crm',
            entity: 'leads',
            id: lead.id,
            label: lead.company_name || getLeadDisplayName(lead),
        });
        return () => setCurrentEntity(null);
    }, [lead?.id, lead?.company_name, setCurrentEntity]); // eslint-disable-line react-hooks/exhaustive-deps

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                <Loader2 className="animate-spin" />
                <span>Loading lead workspace...</span>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p className="text-slate-700 dark:text-slate-200 font-medium">You don't have permission to view this lead.</p>
                <p className="mt-1 text-sm">Ask an administrator to grant your role access to CRM leads.</p>
                <button onClick={() => navigate(backRoute)} className="text-blue-500 hover:underline mt-4 inline-block">{backLabel}</button>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>Lead not found.</p>
                <button onClick={() => navigate(backRoute)} className="text-blue-500 hover:underline mt-4 inline-block">{backLabel}</button>
            </div>
        );
    }

    const tabCounts: TabCounts = {
        tasks: associatedTasks.length,
        documents: lead.documents?.length || 0,
        products: productCount,
    };

    // Use backend-calculated score stored on the lead
    const score = lead.auto_score ?? 0;
    const breakdown = (lead.score_breakdown ?? []).map(item => ({
        label: item.rule_name,
        points: item.points,
    }));

    const getScoreCategory = () => {
        const defaultCategories = [
            { label: 'Cold',      min_score: 0,   max_score: 30,  color: '#6b7280' },
            { label: 'Warm',      min_score: 31,  max_score: 60,  color: '#f59e0b' },
            { label: 'Hot',       min_score: 61,  max_score: 100, color: '#f97316' },
            { label: 'Qualified', min_score: 101, max_score: null, color: '#22c55e' },
        ];
        const cats = scoreCategories.length > 0 ? scoreCategories : defaultCategories;
        return cats.find(c => score >= c.min_score && (c.max_score === null || score <= c.max_score))
            || cats[0];
    };

    const scoreCategory = getScoreCategory();

    // Task 4 (Customer Timeline): the old client-side getAggregatedTimeline()
    // (5-source merge, duplicated again in ActivityHistoryDrawer.tsx) has been
    // replaced by the server-side unified timeline — see useEntityTimeline()
    // below and the Activity tab render block.

    const calculateLegacyRevenue = () => {
        const earned = associatedDeals
            .filter(d => d.stage === 'Won')
            .reduce((sum, d) => sum + d.value, 0);

        const pipeline = associatedDeals
            .filter(d => d.stage !== 'Won' && d.stage !== 'Lost')
            .reduce((sum, d) => sum + d.value, 0);

        const totalValue = earned + pipeline;
        const dealCount = associatedDeals.length;

        return { earned, pipeline, totalValue, dealCount };
    };

    const { earned, pipeline, totalValue, dealCount } = calculateLegacyRevenue();

    const handleTaskToggle = async (task: Task) => {
        const newStatus = task.status === 'DONE' ? 'OPEN' : 'DONE';
        try {
            // Optimistic update
            const updatedTask = { ...task, status: newStatus };
            setAssociatedTasks(prev => prev.map(t => t.id === task.id ? updatedTask as Task : t));

            await crmService.updateTask(task.id, { status: newStatus });

            await crmService.logActivity({
                lead_id: lead.id,
                type: 'TASK',
                notes: `Task "${task.title}" marked as ${newStatus}`,
                date: new Date().toISOString()
            });

            fetchLeadData(); // Refresh to ensure consistency
        } catch (error) {
            console.error('Failed to toggle task status:', error);
            toast.error('Failed to update task status');
            // Revert on error
            setAssociatedTasks(prev => prev.map(t => t.id === task.id ? task : t));
        }
    };

    const handleDeleteLead = async () => {
        setIsDeleting(true);
        const leadName = lead ? getLeadDisplayName(lead) : id;
        try {
            await crmService.deleteLead(id);
            toast.success('Lead deleted successfully');
            recordActivity({ eventType: 'lead.deleted', eventCategory: 'crm', description: `Deleted lead "${leadName}"`, resourceType: 'lead', resourceId: id }).catch(() => {});
            navigate(isCustomerDetailRoute ? '/crm/customers' : '/crm/leads');
        } catch (error: any) {
            // Never the raw router text ("Cannot DELETE /leads/<id>") — that is
            // exactly what users were shown when this route did not exist.
            toast.error(describeApiError(error, 'We couldn’t delete this lead. Please try again.'));
            setIsDeleting(false);
        }
    };

    const tabCls = (tab: TabType) =>
        `flex shrink-0 items-center gap-2 px-4 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
            activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                : 'text-slate-300 hover:text-slate-50'
        }`;

    return (
        <div className="p-8">
            <header className="mb-8">
                <DetailBackLink fallbackTo={backRoute} className="mb-4" />
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2 relative">
                            {isChangingStatus ? (
                                <select
                                    value={leadStages.find(s => s.name === lead.status)?.id || (lead as any).backend_status || ''}
                                    onChange={async (e) => {
                                        const stageId = e.target.value;
                                        const stage = leadStages.find(s => s.id === stageId);
                                        const displayName = stage?.name || stageId;
                                        // Field-diff history (old/new status, actor, timestamp) is now
                                        // captured server-side by the leads audit trigger (Task 7) —
                                        // see the Audit History tab, not a client-side logActivity call.
                                        await crmService.updateLead(lead.id, { status: displayName as any });
                                        fetchLeadData();
                                        setIsChangingStatus(false);
                                    }}
                                    onBlur={() => setIsChangingStatus(false)}
                                    autoFocus
                                    className="bg-slate-900 border border-slate-700 text-xs font-black uppercase text-slate-50 rounded px-2 py-1 outline-none"
                                >
                                    {leadStages.map(stage => (
                                        <option key={stage.id} value={stage.id}>{stage.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsChangingStatus(true)}>
                                    <h1 className="text-4xl font-black text-slate-50 tracking-tight">{getLeadDisplayName(lead)}</h1>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border transition-all group-hover:scale-110 ${lead.status === 'Converted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        lead.status === 'Lost' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        }`}>
                                        {lead.status}
                                    </span>
                                    {lead.type === 'partner' && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border bg-violet-500/10 text-violet-400 border-violet-500/20">
                                            Partner
                                        </span>
                                    )}
                                    <Edit2 size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>
                        <p className="text-xl text-slate-400 flex items-center gap-2 font-medium">
                            <Building2 size={20} className="text-slate-500" />
                            {lead.company_name}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {/* Icon-only: the trash glyph is unambiguous, and dropping the
                            word keeps the destructive secondary action from competing
                            with the primary CTA beside it. Name is carried by
                            aria-label + title so it stays announced and hoverable. */}
                        {canDeleteLead && <button
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label="Delete"
                            title="Delete"
                            className="bg-slate-800 hover:bg-red-600/20 text-slate-300 hover:text-red-400 p-3 rounded-xl transition-all flex items-center justify-center border border-slate-700 hover:border-red-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                        >
                            <Trash2 size={16} />
                        </button>}
                        {canCreateDeal && <button
                            onClick={() => setIsCreatingDeal(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black transition-all shadow-xl shadow-blue-900/30 active:scale-95 text-xs flex items-center gap-2 uppercase tracking-widest"
                        >
                            <Plus size={16} />
                            Create Deal
                        </button>}
                    </div>
                </div>
            </header>

            {/* Lead Journey Stepper — only for leads, not customers */}
            {!isCustomerDetailRoute && (
            <div className="mb-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Lead Journey</h3>
                <LeadJourneyStepper currentState={(lead as any).current_flow_state || lead.status} />
            </div>
            )}

            <QuickActionBar
                onAddNote={() => {
                    openWorkspaceTab('notes');
                    // The composer is the point of "Add Note" — put the caret in it.
                    window.setTimeout(() => {
                        noteComposerRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
                    }, 350);
                }}
                onSendEmail={() => openWorkspaceTab('emails')}
                onLogCall={() => setIsLoggingCall(true)}
                onScheduleMeeting={() => setIsSchedulingMeeting(true)}
                onCreateTask={() => setIsCreatingTask(true)}
                onUploadDocument={() => {
                    openWorkspaceTab('documents');
                    // Open the OS file dialog directly rather than only revealing
                    // the tab that contains the (hidden) file input.
                    window.setTimeout(() => documentInputRef.current?.click(), 350);
                }}
            />

            {/* Executive Summary Dashboard */}
            <ExecutiveSummaryPanel
                lead={lead}
                deals={associatedDeals}
                tasks={associatedTasks}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Lead Information Tabs Card */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-fit">
                        <div className="flex border-b border-slate-800 bg-slate-900/50">
                            <button
                                onClick={() => setInfoTab('profile')}
                                className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${infoTab === 'profile' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Users size={14} /> Full Profile
                            </button>
                            {customFieldDefs.length > 0 && (
                                <button
                                    onClick={() => setInfoTab('additional')}
                                    className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${infoTab === 'additional' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Info size={14} /> Additional Info
                                </button>
                            )}
                            <button
                                onClick={() => setInfoTab('business')}
                                className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${infoTab === 'business' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Building2 size={14} /> Business Profile
                            </button>
                            <div className="ml-auto flex items-center px-6">
                                <button
                                    onClick={async () => {
                                        if (isEditingInfo) {
                                            const nextErrors = {
                                                first_name: validateFirstNameRequired(lead.first_name || ''),
                                                last_name: validateLastName(lead.last_name || ''),
                                                contact_email: validateEmailRequired(lead.contact_email || '', 'Email'),
                                                phone: validatePhone(lead.phone || ''),
                                            };
                                            if (Object.values(nextErrors).some(Boolean)) {
                                                // Stay in edit mode with the entered values intact so the
                                                // user can correct in place rather than retype.
                                                setEditErrors(nextErrors);
                                                toast.error('Please correct the highlighted fields.');
                                                return;
                                            }
                                            setEditErrors({});
                                            try {
                                                // Field-diff history is now captured server-side by the
                                                // leads audit trigger (Task 7) — see the Audit History tab.
                                                await crmService.updateLead(lead.id, lead);
                                                recordActivity({ eventType: 'lead.updated', eventCategory: 'crm', description: `Updated lead "${getLeadDisplayName(lead)}"`, resourceType: 'lead', resourceId: lead.id }).catch(() => {});
                                                fetchLeadData();
                                            } catch (error) {
                                                console.error('Failed to save lead info', error);
                                                const status = (error as { status?: number })?.status;
                                                const message = (error as Error)?.message;
                                                toast.error(
                                                    status && status >= 400 && status < 500 && message
                                                        ? message
                                                        : 'Failed to save changes.',
                                                );
                                                return;
                                            }
                                        }
                                        setIsEditingInfo(!isEditingInfo);
                                    }}
                                    className={`p-2 rounded-lg transition-all ${isEditingInfo ? 'bg-blue-600 text-slate-50 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                                    title={isEditingInfo ? "Save Changes" : "Edit Intelligence"}
                                >
                                    {isEditingInfo ? <CheckCircle2 size={16} /> : <Edit2 size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="p-8">
                            {infoTab === 'profile' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shadow-inner">
                                                <Users size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">First Name</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        type="text"
                                                        value={lead.first_name || ''}
                                                        onChange={(e) => {
                                                            setLead({ ...lead, first_name: e.target.value });
                                                            setEditErrors(prev => ({ ...prev, first_name: validateFirstNameRequired(e.target.value) }));
                                                        }}
                                                        aria-invalid={!!editErrors.first_name}
                                                        className={`bg-slate-950 border text-sm font-bold text-slate-50 rounded px-2 py-1 outline-none ${editErrors.first_name ? 'border-red-500' : 'border-slate-800 focus:border-blue-500'}`}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold uppercase tracking-tight">{lead.first_name || '—'}</span>
                                                )}
                                                {isEditingInfo && editErrors.first_name && (
                                                    <p className="text-xs text-red-400 mt-1">{editErrors.first_name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shadow-inner">
                                                <Users size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Last Name</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        type="text"
                                                        value={lead.last_name || ''}
                                                        onChange={(e) => {
                                                            setLead({ ...lead, last_name: e.target.value });
                                                            setEditErrors(prev => ({ ...prev, last_name: validateLastName(e.target.value) }));
                                                        }}
                                                        aria-invalid={!!editErrors.last_name}
                                                        className={`bg-slate-950 border text-sm font-bold text-slate-50 rounded px-2 py-1 outline-none ${editErrors.last_name ? 'border-red-500' : 'border-slate-800 focus:border-blue-500'}`}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold uppercase tracking-tight">{lead.last_name || '—'}</span>
                                                )}
                                                {isEditingInfo && editErrors.last_name && (
                                                    <p className="text-xs text-red-400 mt-1">{editErrors.last_name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400 shadow-inner">
                                                <Mail size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Email</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        /* `text`, not `email`: the browser's native popup
                                                           pre-empted the inline message here too. */
                                                        type="text"
                                                        inputMode="email"
                                                        value={lead.contact_email}
                                                        onChange={(e) => {
                                                            setLead({ ...lead, contact_email: e.target.value });
                                                            setEditErrors(prev => ({ ...prev, contact_email: validateEmailRequired(e.target.value, 'Email') }));
                                                        }}
                                                        aria-invalid={!!editErrors.contact_email}
                                                        className={`bg-slate-950 border text-sm font-bold text-slate-50 rounded px-2 py-1 outline-none ${editErrors.contact_email ? 'border-red-500' : 'border-slate-800 focus:border-blue-500'}`}
                                                    />
                                                ) : (
                                                    <a href={`mailto:${lead.contact_email}`} className="text-sm font-bold hover:text-blue-400 transition-colors uppercase tracking-tight">{lead.contact_email}</a>
                                                )}
                                                {isEditingInfo && editErrors.contact_email && (
                                                    <p className="text-xs text-red-400 mt-1">{editErrors.contact_email}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-purple-400 shadow-inner">
                                                <Phone size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Phone</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        type="text"
                                                        value={lead.phone || ''}
                                                        onChange={(e) => {
                                                            setLead({ ...lead, phone: e.target.value });
                                                            setEditErrors(prev => ({ ...prev, phone: validatePhone(e.target.value) }));
                                                        }}
                                                        placeholder="Add phone..."
                                                        aria-invalid={!!editErrors.phone}
                                                        className={`bg-slate-950 border text-sm font-bold text-slate-50 rounded px-2 py-1 outline-none ${editErrors.phone ? 'border-red-500' : 'border-slate-800 focus:border-blue-500'}`}
                                                    />
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-sm font-bold uppercase tracking-tight">{lead.phone || 'Not provided'}</span>
                                                        <ClickToCallButton
                                                            number={lead.phone}
                                                            entityType={isCustomerDetailRoute ? 'contact' : 'lead'}
                                                            entityId={lead.id}
                                                            name={getLeadDisplayName(lead)}
                                                        />
                                                    </span>
                                                )}
                                                {isEditingInfo && editErrors.phone && (
                                                    <p className="text-xs text-red-400 mt-1">{editErrors.phone}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 shadow-inner">
                                                <Tag size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Source</span>
                                                {isEditingInfo ? (
                                                    <select
                                                        value={lead.source}
                                                        onChange={(e) => setLead({ ...lead, source: e.target.value })}
                                                        className="bg-slate-950 border border-slate-800 text-sm font-bold text-slate-50 rounded px-2 py-1 outline-none focus:border-blue-500"
                                                    >
                                                        <option value="">— Select source —</option>
                                                        {sourceTypes.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm font-bold uppercase tracking-tight">
                                                        {sourceTypes.find(o => o.value === lead.source)?.label ?? lead.source}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-violet-400 shadow-inner">
                                                <Users size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Referred By</span>
                                                {isEditingInfo ? (
                                                    <PartnerSearchDropdown
                                                        partners={partners}
                                                        value={lead.referred_by || ''}
                                                        onChange={(id) => setLead({ ...lead, referred_by: id || undefined })}
                                                        placeholder="Search and select partner..."
                                                        inputClassName="text-sm font-bold"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold uppercase tracking-tight">
                                                        {partners.find(p => p.id === lead.referred_by)?.company_name || '—'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isEditingInfo && (
                                            <div className="flex items-center gap-4 text-slate-300">
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-violet-400 shadow-inner">
                                                    <Users size={18} />
                                                </div>
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Partner</span>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={lead.type === 'partner'}
                                                            onChange={(e) => setLead({ ...lead, type: e.target.checked ? 'partner' : 'lead' })}
                                                            className="w-4 h-4 rounded accent-violet-500"
                                                        />
                                                        <span className="text-sm font-bold">Mark as Partner</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-slate-300 text-opacity-50">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400 shadow-inner opacity-50">
                                                <Calendar size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Created</span>
                                                <span className="text-sm font-bold uppercase tracking-tight">{formatters.formatDate(lead.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {infoTab === 'additional' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
                                    {customFieldDefs.map(field => (
                                        <div key={field.id} className="flex items-center gap-4 text-slate-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
                                                {field.type === 'date' ? <Calendar size={18} /> : field.type === 'boolean' ? <CheckCircle2 size={18} /> : <Tag size={18} />}
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">{field.label}</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        type={field.type === 'number' ? 'number' : 'text'}
                                                        value={lead.custom_fields?.[field.id] || ''}
                                                        onChange={(e) => setLead({
                                                            ...lead,
                                                            custom_fields: {
                                                                ...lead.custom_fields,
                                                                [field.id]: e.target.value
                                                            }
                                                        })}
                                                        className="bg-slate-950 border border-slate-800 text-sm font-bold text-slate-50 rounded px-2 py-1 outline-none focus:border-blue-500"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-bold uppercase tracking-tight">
                                                        {field.type === 'boolean'
                                                            ? (lead.custom_fields?.[field.id] ? 'Yes' : 'No')
                                                            : field.type === 'date' && lead.custom_fields?.[field.id]
                                                                ? formatters.formatDate(lead.custom_fields[field.id])
                                                                : lead.custom_fields?.[field.id] || '—'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {infoTab === 'business' && (
                                <CustomerDetailsPanel
                                    lead={lead}
                                    onUpdate={(updatedLead) => setLead(updatedLead)}
                                    showToast={(message, type) => type === 'success' ? toast.success(message) : toast.error(message)}
                                    partners={partners as any}
                                />
                            )}
                        </div>
                    </section>

                    {/* Workspace Tabs - Now below Profile Data */}
                    <div ref={workspaceRef} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-fit scroll-mt-6">
                        {/* The settings cog sits outside the scrolling strip: inside it, it
                            consumed the width the last tab needed and clipped its label
                            (the "Feedbac…" report). The strip scrolls on its own, with a
                            fade on the right edge so it reads as scrollable rather than cut
                            off — every label stays whole at any width or zoom level. */}
                        <div className="flex items-stretch border-b border-slate-800 bg-slate-900/50">
                            <div className="relative flex-1 min-w-0">
                                <div className="flex items-center overflow-x-auto scrollbar-hide" data-testid="detail-tab-strip">
                                    {layoutPrefs.visibleSections.map((section) => {
                                        const tab = TAB_CONFIG[section.key];
                                        if (!tab) return null;
                                        return (
                                            <button key={section.key} onClick={() => setActiveTab(section.key as TabType)} className={tabCls(section.key as TabType)}>
                                                {tab.icon} {tab.label(tabCounts)}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900 to-transparent"
                                />
                            </div>
                            <button
                                onClick={() => setShowLayoutSettings(true)}
                                className="px-3 text-slate-300 hover:text-slate-50 transition-colors shrink-0 border-l border-slate-800"
                                title="Layout Settings"
                                aria-label="Layout Settings"
                            >
                                <Settings2 size={14} />
                            </button>
                        </div>

                        <div className="px-4 pt-3">
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={commSearchQuery}
                                    onChange={(e) => setCommSearchQuery(e.target.value)}
                                    placeholder="Search notes, tasks, deals…"
                                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40"
                                />
                            </div>
                            {commSearchQuery.trim() && (
                                <div className="mt-2 max-h-64 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800/70">
                                    {commSearchResults.length === 0 ? (
                                        <p className="text-[11px] text-slate-600 italic px-3 py-2">No matches.</p>
                                    ) : (
                                        commSearchResults.map((r) => (
                                            <button
                                                key={r.id}
                                                onClick={() => { setActiveTab(r.tab); setCommSearchQuery(''); }}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-900 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.kind}</span>
                                                    <span className="text-[9px] text-slate-600">{formatters.formatDate(r.date)}</span>
                                                </div>
                                                <p className="text-xs text-slate-300 truncate">{r.title}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6">
                            {activeTab === 'activity' && (
                                <div className="space-y-6">
                                    {/* Header */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer Timeline</p>
                                            <p className="text-[10px] text-slate-600 mt-0.5">
                                                Showing latest {entityTimeline.events.length}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowActivityDrawer(true)}
                                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            <ExternalLink size={11} />
                                            View All History
                                        </button>
                                    </div>

                                    {/* AI/health summary */}
                                    {entityTimeline.summary && <TimelineSummaryBanner summary={entityTimeline.summary} />}

                                    {/* Timeline */}
                                    <div className="space-y-3 relative">
                                        {entityTimeline.loading ? (
                                            <div className="flex items-center justify-center py-8 text-slate-500">
                                                <Loader2 size={18} className="animate-spin" />
                                            </div>
                                        ) : entityTimeline.events.length === 0 ? (
                                            <div className="text-center py-8 ml-6">
                                                <p className="text-slate-500 italic text-sm">No activities logged yet.</p>
                                                <p className="text-slate-600 text-[10px] mt-1">Activities will appear here automatically when users interact with this lead.</p>
                                            </div>
                                        ) : (
                                            entityTimeline.events.map((event) => (
                                                <TimelineEventCard
                                                    key={event.id}
                                                    event={event}
                                                    isPinned={entityTimeline.pinnedIds.has(event.id)}
                                                    onTogglePin={entityTimeline.togglePin}
                                                    onEdit={async (e) => {
                                                        const newNotes = prompt('Edit activity notes:', e.description);
                                                        if (newNotes !== null && e.related_id) {
                                                            await activitiesApi.update(e.related_id, { notes: newNotes });
                                                            entityTimeline.updateEventDescription(e.id, newNotes);
                                                        }
                                                    }}
                                                    onDelete={async (e) => {
                                                        if (confirm('Delete this activity?') && e.related_id) {
                                                            await activitiesApi.delete(e.related_id);
                                                            entityTimeline.removeEvent(e.id);
                                                        }
                                                    }}
                                                />
                                            ))
                                        )}
                                    </div>

                                    {entityTimeline.hasMore && (
                                        <div className="flex flex-col items-center gap-3 pt-2">
                                            <button
                                                onClick={entityTimeline.loadMore}
                                                disabled={entityTimeline.loadingMore}
                                                className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors font-bold uppercase tracking-widest disabled:opacity-50"
                                            >
                                                {entityTimeline.loadingMore ? 'Loading…' : 'Load More →'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 'notes' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        {lead.notes.length === 0 ? (
                                            <p className="text-slate-400 italic text-sm">No notes captured for this lead yet.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {lead.notes.map(note => (
                                                    <div key={note.id} className="text-sm border-l-2 border-amber-500/30 pl-4 py-1 group/note relative">
                                                        {editingNoteId === note.id ? (
                                                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-2">
                                                                <NoteEditor value={editingNoteContent} onChange={setEditingNoteContent} autoFocus />
                                                                <div className="flex justify-end gap-2 mt-3">
                                                                    <button
                                                                        onClick={() => setEditingNoteId(null)}
                                                                        className="text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (isNoteContentEmpty(editingNoteContent)) return;
                                                                            await crmService.updateNote(note.id, editingNoteContent);
                                                                            setLead({
                                                                                ...lead,
                                                                                notes: lead.notes.map(n => n.id === note.id ? { ...n, content: editingNoteContent } : n)
                                                                            });
                                                                            setEditingNoteId(null);
                                                                        }}
                                                                        disabled={isNoteContentEmpty(editingNoteContent)}
                                                                        className="bg-slate-700/60 hover:bg-slate-600/60 text-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-slate-600/50 disabled:opacity-50"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="absolute right-0 top-0 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-2">
                                                                    <button
                                                                        aria-label="Edit note"
                                                                        data-testid={`edit-note-${note.id}`}
                                                                        onClick={() => {
                                                                            setEditingNoteId(note.id);
                                                                            setEditingNoteContent(note.content);
                                                                        }}
                                                                        className="text-slate-500 hover:text-blue-400"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button
                                                                        aria-label="Delete note"
                                                                        data-testid={`delete-note-${note.id}`}
                                                                        onClick={async () => {
                                                                            if (confirm('Delete this note?')) {
                                                                                await crmService.deleteNote(note.id);
                                                                                setLead({
                                                                                    ...lead,
                                                                                    notes: lead.notes.filter(n => n.id !== note.id)
                                                                                });
                                                                            }
                                                                        }}
                                                                        className="text-slate-500 hover:text-rose-400"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                                <div className="mb-2 pr-12">
                                                                    <NoteContent html={note.content} />
                                                                </div>
                                                            </>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{note.author.full_name}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold">{formatters.formatDate(note.created_at)}</span>
                                                        </div>

                                                        {(note.replies || []).length > 0 && (
                                                            <div className="mt-3 ml-4 space-y-3 border-l border-slate-800 pl-4">
                                                                {(note.replies || []).map((reply) => (
                                                                    <div key={reply.id} className="text-sm">
                                                                        <NoteContent html={reply.content} />
                                                                        <div className="flex items-center justify-between mt-1">
                                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{reply.author?.full_name}</span>
                                                                            <span className="text-[9px] text-slate-500 font-bold">{formatters.formatDate(reply.created_at)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="mt-2 ml-4">
                                                            <NoteReplyComposer
                                                                people={allUsers}
                                                                onSubmit={async (content) => {
                                                                    const freshReply = await crmService.createNote({ lead_id: lead.id, content, parent_note_id: note.id });
                                                                    setLead({
                                                                        ...lead,
                                                                        notes: lead.notes.map((n) => n.id === note.id ? { ...n, replies: [...(n.replies || []), freshReply] } : n),
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div ref={noteComposerRef} className="bg-slate-950 border border-slate-800 rounded-xl p-4 transition-all focus-within:ring-1 focus-within:ring-blue-500/30">
                                            <NoteEditor
                                                key={noteEditorKey}
                                                value={newNoteContent}
                                                onChange={setNewNoteContent}
                                                placeholder="Add a private note about this lead..."
                                            />
                                            <div className="flex justify-end mt-3">
                                                <button
                                                    onClick={async () => {
                                                        if (isNoteContentEmpty(newNoteContent)) return;
                                                        const freshNote = await crmService.createNote({ lead_id: lead.id, content: newNoteContent });
                                                        setLead({
                                                            ...lead,
                                                            notes: [...(lead.notes || []), freshNote]
                                                        });
                                                        setNewNoteContent('');
                                                        setNoteEditorKey((k) => k + 1);
                                                    }}
                                                    disabled={isNoteContentEmpty(newNoteContent)}
                                                    className="bg-slate-700/60 hover:bg-slate-600/60 text-slate-50 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-slate-600/50 disabled:opacity-50 shadow-sm"
                                                >
                                                    Save Note
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tasks' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Tasks</p>
                                            {associatedTasks.some(t => t.type === 'REMINDER' && t.status === 'OPEN' && new Date(t.due_date) <= new Date(new Date().getTime() + 60 * 60 * 1000)) && (
                                                <span className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                                    Due Reminders
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsCreatingTask(true)}
                                            className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-2 rounded-lg hover:bg-blue-500/20 transition-all uppercase tracking-widest flex items-center gap-2"
                                        >
                                            <Plus size={12} /> Add Task
                                        </button>
                                    </div>

                                    {/* Reminders Alert Section */}
                                    {associatedTasks.filter(t => t.type === 'REMINDER' && t.status === 'OPEN' && new Date(t.due_date) <= new Date(new Date().getTime() + 24 * 60 * 60 * 1000)).length > 0 && (
                                        /* Notification strip — deliberately NOT card-shaped, so it
                                           never reads as a second copy of the task below. */
                                        <div className="mb-6" data-testid="task-reminders-panel">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock size={12} className="text-amber-500" />
                                                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                                    Upcoming &amp; Due Reminders
                                                </h4>
                                                <span className="text-[10px] text-slate-300 normal-case tracking-normal">
                                                    · alerts for tasks already listed below
                                                </span>
                                            </div>
                                            <div className="divide-y divide-amber-500/10 border-l-2 border-amber-500 bg-amber-500/[0.06] rounded-r">
                                                {associatedTasks
                                                    .filter(t => t.type === 'REMINDER' && t.status === 'OPEN' && new Date(t.due_date) <= new Date(new Date().getTime() + 24 * 60 * 60 * 1000))
                                                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                                    .map(task => {
                                                        const reminderOverdue = new Date(task.due_date) < new Date();
                                                        return (
                                                            <button
                                                                key={task.id}
                                                                type="button"
                                                                onClick={() => focusTaskInList(task.id)}
                                                                data-testid={`task-reminder-${task.id}`}
                                                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-amber-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                                                            >
                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${reminderOverdue ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                                                                <span className="text-xs font-semibold text-slate-300 truncate">{task.title}</span>
                                                                <span className={`text-[11px] shrink-0 ${reminderOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                                                                    {reminderOverdue ? 'Overdue · ' : ''}{formatters.formatDateTime(task.due_date)}
                                                                </span>
                                                                <span className="ml-auto text-[10px] font-black text-amber-500 uppercase tracking-widest shrink-0">
                                                                    View Task
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}
                                    {associatedTasks.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                                            <CheckCircle2 size={32} className="mx-auto mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No active tasks or follow-ups.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {associatedTasks.map(task => {
                                                const overdue = isTaskOverdue(task.due_date) && task.status !== 'DONE';
                                                return (
                                                <div key={task.id} id={`task-card-${task.id}`} className={`flex items-start gap-4 p-4 bg-slate-950 border rounded-xl group shadow-sm relative transition-all ${highlightedTaskId === task.id ? 'ring-2 ring-amber-500/70' : ''} ${task.status === 'DONE' ? 'border-emerald-500/20 opacity-60' : overdue ? 'border-rose-500/40 hover:border-rose-500/60 bg-rose-950/10' : 'border-slate-800 hover:border-blue-500/50'}`}>
                                                    <button
                                                        onClick={() => handleTaskToggle(task)}
                                                        className={`mt-1 w-5 h-5 rounded border transition-colors shrink-0 flex items-center justify-center ${task.status === 'DONE' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'border-slate-700 group-hover:border-blue-500'}`}
                                                    >
                                                        <CheckCircle2 size={12} className={`transition-opacity ${task.status === 'DONE' ? 'opacity-100' : 'opacity-0 group-hover:opacity-20 text-blue-500'}`} />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <Link to={`/crm/tasks/${task.id}`} className="block group/link">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className={`text-sm font-bold text-slate-50 leading-tight truncate group-hover/link:text-blue-400 transition-colors ${task.status === 'DONE' ? 'line-through text-slate-500' : ''}`}>
                                                                    {task.title || 'Untitled Task'}
                                                                </h4>
                                                                <div className="flex items-center gap-2">
                                                                    {overdue && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border bg-rose-500/10 text-rose-400 border-rose-500/30" data-testid={`overdue-badge-${task.id}`}>
                                                                            Overdue
                                                                        </span>
                                                                    )}
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setExpandedStatusDropdown(expandedStatusDropdown === task.id ? null : task.id);
                                                                            }}
                                                                            className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border cursor-pointer transition-all hover:shadow-md ${task.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}
                                                                            data-testid={`status-button-${task.id}`}
                                                                        >
                                                                            {task.status}
                                                                        </button>
                                                                        {expandedStatusDropdown === task.id && (
                                                                            <div className="absolute top-full mt-1 right-0 z-10 bg-slate-900 border border-slate-700 rounded-lg shadow-lg" data-testid={`status-dropdown-${task.id}`}>
                                                                                {['OPEN', 'IN_PROGRESS', 'DONE'].map((status) => (
                                                                                    <button
                                                                                        key={status}
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            crmService.updateTask(task.id, { status: status as any })
                                                                                                .then(() => {
                                                                                                    setAssociatedTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: status as any } : t));
                                                                                                    setExpandedStatusDropdown(null);
                                                                                                    toast.success(`Task status updated to ${status}`);
                                                                                                })
                                                                                                .catch(error => {
                                                                                                    console.error('Failed to update task status:', error);
                                                                                                    toast.error('Failed to update task status');
                                                                                                });
                                                                                        }}
                                                                                        className={`w-full text-left px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-colors ${task.status === status ? 'bg-blue-500/20 text-blue-400 border-b border-blue-500/20' : 'hover:bg-slate-800 text-slate-300'}`}
                                                                                        data-testid={`status-option-${task.id}-${status}`}
                                                                                    >
                                                                                        {status}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {task.description && (
                                                                <p className="text-xs text-slate-300 mt-1 line-clamp-2">{task.description}</p>
                                                            )}
                                                        </Link>

                                                        {/* Metadata row: readable in its own right, one weight below the
                                                            title. The previous slate-500 / rose-400/70 pairing sat under
                                                            3:1 on the light theme's white card. */}
                                                        <div className="flex items-center gap-4 mt-3 text-[11px] font-bold text-slate-300 uppercase tracking-wider border-t border-slate-800/50 pt-2">
                                                            <span className={`flex items-center gap-1 ${overdue ? 'text-rose-400' : 'text-slate-300'}`}>
                                                                <Clock size={11} />
                                                                Due {formatters.formatDate(task.due_date)}
                                                            </span>

                                                            {task.assigned_to && (
                                                                <span className="flex items-center gap-1 text-slate-300">
                                                                    <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                                                                        {task.assigned_to.avatar_url ? <img src={task.assigned_to.avatar_url} alt={task.assigned_to.full_name} className="w-full h-full object-cover" /> : task.assigned_to.full_name?.charAt(0)}
                                                                    </div>
                                                                    {task.assigned_to.full_name}
                                                                </span>
                                                            )}

                                                            {task.deal_name && (
                                                                <>
                                                                    <span className="w-1 h-1 bg-slate-400 rounded-full" />
                                                                    <span className="text-blue-400 lowercase italic">{task.deal_name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                        <button
                                                            onClick={() => !isTaskLocked(task.status) && setEditingTask(task)}
                                                            disabled={isTaskLocked(task.status)}
                                                            title={isTaskLocked(task.status) ? TASK_LOCKED_HINT : 'Edit Task'}
                                                            aria-label="Edit Task"
                                                            className="p-1.5 bg-slate-800 rounded hover:text-blue-400 hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:text-current"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'documents' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Digital Assets & Contracts</p>
                                        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${isUploading ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-slate-50 shadow-lg shadow-blue-500/20 active:scale-95'}`}>
                                            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                            {isUploading ? 'Uploading...' : 'Upload Document'}
                                            <input
                                                ref={documentInputRef}
                                                type="file"
                                                className="hidden"
                                                disabled={isUploading}
                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.png,.jpg,.jpeg,.svg,.webp,.gif"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file && lead) {
                                                        setIsUploading(true);
                                                        try {
                                                            const newDoc = await crmService.uploadDocument(lead.id, file);
                                                            setLead({
                                                                ...lead,
                                                                documents: [...(lead.documents || []), newDoc]
                                                            });
                                                            publishLeadDocumentsChanged(lead.id);
                                                        } catch (err) {
                                                            const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
                                                            toast.error(msg);
                                                        } finally {
                                                            setIsUploading(false);
                                                            e.target.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>

                                    {(!lead.documents || lead.documents.length === 0) ? (
                                        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                                            <FileIcon size={48} className="mx-auto mb-4 opacity-10" />
                                            <p className="text-sm font-bold uppercase tracking-widest mb-1">No documents attached</p>
                                            <p className="text-xs text-slate-400 lowercase italic">Centralize proposals, contracts, and requirement docs here.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {lead.documents.map(doc => (
                                                <div key={doc.id} className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl group hover:border-slate-700 transition-all shadow-sm">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-blue-500 border border-slate-800 group-hover:scale-105 transition-transform shadow-inner">
                                                        <File size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-bold text-slate-50 truncate group-hover:text-blue-400 transition-colors">{doc.name}</h4>
                                                        <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                            <span>{(doc.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                            <span className="w-1 h-1 bg-slate-800 rounded-full" />
                                                            <span>{formatters.formatDate(doc.uploaded_at)}</span>
                                                            <span className="w-1 h-1 bg-slate-800 rounded-full" />
                                                            <span className="text-slate-500">by {doc.uploaded_by.full_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {doc.dmsDocumentId ? (
                                                            <button
                                                                onClick={() => { void openLeadDocument(doc); }}
                                                                className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-all"
                                                                title="View"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                        ) : (
                                                            <a
                                                                href={doc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-all"
                                                                title="View"
                                                            >
                                                                <Eye size={16} />
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const fetchUrl = doc.dmsDocumentId
                                                                        ? await crmService.getDocumentDownloadUrl(doc.id)
                                                                        : doc.url;
                                                                    const res = await fetch(fetchUrl);
                                                                    const blob = await res.blob();
                                                                    const blobUrl = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = blobUrl;
                                                                    a.download = doc.name;
                                                                    a.click();
                                                                    URL.revokeObjectURL(blobUrl);
                                                                } catch {
                                                                    if (doc.dmsDocumentId) {
                                                                        void openLeadDocument(doc);
                                                                    } else {
                                                                        window.open(doc.url, '_blank');
                                                                    }
                                                                }
                                                            }}
                                                            className="p-2 text-slate-500 hover:text-slate-50 hover:bg-slate-800 rounded-lg transition-all"
                                                            title="Download"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Delete this document?')) {
                                                                    await crmService.deleteDocument(lead.id, doc.id);
                                                                    setLead({
                                                                        ...lead,
                                                                        documents: lead.documents?.filter(d => d.id !== doc.id)
                                                                    });
                                                                    publishLeadDocumentsChanged(lead.id);
                                                                }
                                                            }}
                                                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                                            title="Delete document"
                                                            aria-label="Delete document"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'products' && lead && (
                                <LeadProductsTab
                                    leadId={lead.id}
                                    onStatsChange={(count, value) => {
                                        setProductCount(count);
                                        setProductValue(value);
                                    }}
                                />
                            )}

                            {activeTab === 'feedback' && lead && (
                                <CustomerFeedbackTab leadId={lead.id} />
                            )}

                            {activeTab === 'calls' && lead && (
                                <CallsTab key={callsRefreshKey} leadId={lead.id} />
                            )}

                            {activeTab === 'audit' && lead && (
                                <AuditHistoryTab entityType="lead" entityId={lead.id} />
                            )}

                            {activeTab === 'stakeholders' && lead && (
                                <StakeholdersTab
                                    leadId={lead.id}
                                    deals={associatedDeals}
                                    onSwitchToNotes={() => setActiveTab('notes')}
                                    onSwitchToCalls={() => setActiveTab('calls')}
                                    onSwitchToMeetings={() => setActiveTab('meetings')}
                                />
                            )}

                            {activeTab === 'emails' && lead && (
                                <EmailsTab leadId={lead.id} />
                            )}

                            {activeTab === 'meetings' && lead && (
                                <MeetingsTab key={meetingsRefreshKey} leadId={lead.id} />
                            )}

                        </div>
                    </div>
                </div>

                {/* Sidebar Context */}
                <div className="space-y-8">

                    {canUseNeuraAi && (
                        <NeuraAiSummaryCard
                            leadId={lead.id}
                            leadLabel={lead.company_name || getLeadDisplayName(lead)}
                            isInboxEnabled={isInboxEnabled}
                        />
                    )}

                    {/* Lead / Customer Potential Score Card */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
                            <Trophy size={120} />
                        </div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                {isCustomerDetailRoute ? 'Customer Potential' : 'Lead Potential'}
                            </h3>
                            <div className="flex items-center gap-2">
                                {!isCustomerDetailRoute && (
                                    <button
                                        onClick={handleRecalculateScore}
                                        disabled={isRecalculatingScore}
                                        title="Recalculate score"
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40"
                                    >
                                        <RefreshCw size={12} className={isRecalculatingScore ? 'animate-spin' : ''} />
                                    </button>
                                )}
                                <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-lg">
                                    <Zap size={14} className="fill-amber-500" />
                                </div>
                            </div>
                        </div>

                        {isCustomerDetailRoute ? (() => {
                            const sfOrders = [];
                            const sfWishlist = [];
                            const sfActivities = [];
                            const sfReviews = [];
                            const sfAbandonedCarts = [];
                            const sfCoupons = [];
                            const engagementScore = Math.min(100,
                                sfOrders.length * 20 +
                                sfWishlist.length * 5 +
                                Math.min(sfActivities.length, 20) * 2 +
                                sfReviews.length * 10 +
                                sfAbandonedCarts.length * 8 +
                                sfCoupons.length * 6
                            );
                            const engagementBreakdown = [
                                { label: `Orders placed (${sfOrders.length})`, points: sfOrders.length * 20 },
                                { label: `Wishlist items (${sfWishlist.length})`, points: sfWishlist.length * 5 },
                                { label: `Browsing sessions (${Math.min(sfActivities.length, 20)})`, points: Math.min(sfActivities.length, 20) * 2 },
                                { label: `Reviews submitted (${sfReviews.length})`, points: sfReviews.length * 10 },
                                { label: `Abandoned carts (${sfAbandonedCarts.length})`, points: sfAbandonedCarts.length * 8 },
                                { label: `Coupons used (${sfCoupons.length})`, points: sfCoupons.length * 6 },
                            ].filter(item => item.points > 0);
                            return (
                                <>
                                    <div className="flex items-end gap-3 mb-6">
                                        <span className="text-6xl font-black text-slate-50 tracking-tighter leading-none">{engagementScore}</span>
                                        <div className="pb-1">
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Engagement</span>
                                            <div className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase tracking-tighter">
                                                <TrendingUp size={12} />
                                                <span>/ 100</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-slate-800/50">
                                        {engagementBreakdown.length === 0 ? (
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic text-center py-2 underline decoration-slate-800 decoration-wavy underline-offset-4">No engagement data yet</p>
                                        ) : (
                                            engagementBreakdown.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                                    <span className="text-slate-400">{item.label}</span>
                                                    <span className="text-emerald-400">+{item.points}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="mt-6 pt-4">
                                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                                                style={{ width: `${engagementScore}%` }}
                                            />
                                        </div>
                                    </div>
                                </>
                            );
                        })() : (
                            <>
                                <div className="flex items-end gap-3 mb-3">
                                    <span className="text-6xl font-black text-slate-50 tracking-tighter leading-none">{score}</span>
                                    <div className="pb-1">
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Score</span>
                                        <div
                                            className="flex items-center gap-1 font-black text-[10px] uppercase tracking-tighter px-2 py-0.5 rounded-md"
                                            style={{ color: scoreCategory.color, backgroundColor: `${scoreCategory.color}20` }}
                                        >
                                            <span>● {scoreCategory.label}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-5 border-t border-slate-800/50">
                                    {breakdown.length === 0 ? (
                                        <div className="text-center py-3">
                                            {scoringRules.filter(r => r.is_active).length === 0 ? (
                                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No active scoring rules configured</p>
                                            ) : (
                                                <>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">0 of {scoringRules.filter(r => r.is_active).length} rules matched</p>
                                                    <button
                                                        onClick={handleRecalculateScore}
                                                        disabled={isRecalculatingScore}
                                                        className="mt-2 text-[9px] font-black uppercase tracking-widest text-amber-500/70 hover:text-amber-400 transition-colors flex items-center gap-1 mx-auto disabled:opacity-40"
                                                    >
                                                        <RefreshCw size={9} className={isRecalculatingScore ? 'animate-spin' : ''} />
                                                        Recalculate
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Matched Rules</p>
                                            {breakdown.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                                    <span className="flex items-center gap-1.5 text-slate-400 truncate mr-2">
                                                        <span className="text-emerald-500 shrink-0">✓</span>
                                                        <span className="truncate">{item.label}</span>
                                                    </span>
                                                    <span className={item.points >= 0 ? 'text-emerald-400 shrink-0' : 'text-rose-400 shrink-0'}>
                                                        {item.points >= 0 ? '+' : ''}{item.points}
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="mt-6 pt-4">
                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${Math.min(100, (score / 150) * 100)}%`,
                                                backgroundColor: scoreCategory.color,
                                                boxShadow: `0 0 8px ${scoreCategory.color}80`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </section>
                    {/* Assigned Owner & Engagement Suite Combined */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm overflow-visible relative">
                        <div className="pb-6 border-b border-slate-800/50">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Assigned Owner</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsChangingOwner(!isChangingOwner)}
                                    className="text-[10px] text-blue-400 font-black uppercase tracking-widest hover:text-blue-300 transition-colors"
                                >
                                    {isChangingOwner ? 'CANCEL' : 'CHANGE'}
                                </button>
                            </div>
                            {isChangingOwner ? (
                                <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {allUsers.map(user => (
                                        <button
                                            type="button"
                                            key={user.id}
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                try {
                                                    // Field-diff history (old/new owner, actor, timestamp)
                                                    // is now captured server-side by the leads audit
                                                    // trigger (Task 7) — see the Audit History tab.
                                                    await crmService.updateLead(lead.id, { owner: user });
                                                    await fetchLeadData();
                                                    setIsChangingOwner(false);
                                                } catch (error) {
                                                    console.error('Failed to update owner:', error);
                                                    toast.error('Failed to update owner.');
                                                }
                                            }}
                                            className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all ${lead.owner && user.id === lead.owner.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-black text-xs">{user.full_name?.charAt(0)}</div>
                                                )}
                                            </div>
                                            <div className="text-left overflow-hidden">
                                                <p className="text-[10px] font-black text-slate-50 uppercase tracking-tight truncate">{user.full_name}</p>
                                                <p className="text-[8px] text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : lead.owner ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-800 shadow-lg">
                                        {lead.owner.avatar_url ? (
                                            <img src={lead.owner.avatar_url} alt={lead.owner.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-xl font-black">{lead.owner.full_name?.charAt(0)}</div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-50 text-sm uppercase tracking-tight leading-none mb-1">{lead.owner.full_name}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{lead.owner.email}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 bg-slate-950/50 border border-slate-800/50 p-3 rounded-xl">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                                        <Users size={18} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-tight">Unassigned</p>
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest">Click CHANGE to assign</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="py-6 border-b border-slate-800/50">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    {isCustomerDetailRoute ? 'CRM Stage' : 'Lead Stage'}
                                </h3>
                                {!isCustomerDetailRoute && (
                                    <button
                                        type="button"
                                        onClick={() => setIsChangingStage(!isChangingStage)}
                                        className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-[0.2em]"
                                    >
                                        {isChangingStage ? 'CANCEL' : 'CHANGE'}
                                    </button>
                                )}
                            </div>

                            {isCustomerDetailRoute ? (
                                <>
                                    <div className="flex items-center gap-3 bg-slate-950/50 border border-slate-800/50 p-3 rounded-xl">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                            <Users size={16} className="text-emerald-400" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Stage</span>
                                            <p className="font-black text-slate-50 text-xs uppercase tracking-tight mt-1">Customer</p>
                                        </div>
                                        <span className="text-[8px] bg-slate-800 text-slate-500 px-2 py-1 rounded font-black uppercase tracking-widest">
                                            Locked
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-2 text-center">Assign to a CRM pipeline from the pipeline view</p>
                                </>
                            ) : isChangingStage ? (
                                <div className="space-y-1">
                                    {leadStages.map(stage => (
                                        <button
                                            type="button"
                                            key={stage.id}
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                try {
                                                    // Field-diff history (old/new stage, duration in
                                                    // previous stage, actor, timestamp) is now captured
                                                    // server-side by the leads audit trigger (Task 7).
                                                    await crmService.updateLead(lead.id, { status: stage.name as any });
                                                    await fetchLeadData();
                                                    setIsChangingStage(false);
                                                } catch (error: any) {
                                                    console.error('Failed to update stage:', error);
                                                    toast.error(error.message || 'Failed to update stage. Please try again.');
                                                }
                                            }}
                                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${stage.name === lead.status
                                                ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                                                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-50'
                                                }`}
                                        >
                                            <span>{stage.name}</span>
                                            {stage.name === lead.status && <CheckCircle2 size={12} />}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    className="flex items-center gap-3 bg-slate-950/50 border border-slate-800/50 p-3 rounded-xl group hover:border-blue-500/20 transition-all cursor-pointer"
                                    onClick={() => setIsChangingStage(true)}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm transition-transform group-hover:scale-105 ${lead.status === 'Converted' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                        lead.status === 'Lost' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                                            'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                        }`}>
                                        <TrendingUp size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Status</span>
                                        <p className="font-black text-slate-50 text-xs uppercase tracking-tight mt-1">
                                            {lead.status}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-6">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Engagement Suite</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setIsCreatingTask(true)}
                                    className="w-full bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95 border border-slate-600/50 shadow-sm"
                                >
                                    <Clock size={14} /> Schedule Follow-up
                                </button>
                                {/* <button
                                    onClick={async () => {
                                        try {
                                            await crmService.logActivity({
                                                lead_id: id,
                                                type: 'EMAIL',
                                                notes: 'Outbound email sent to lead contact',
                                                date: new Date().toISOString()
                                            });
                                            fetchLeadData();
                                            setActiveTab('activity');
                                        } catch (error: any) {
                                            console.error('Failed to log email:', error);
                                            toast.error(error.message || 'Failed to log email.');
                                        }
                                    }}
                                    className="w-full bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95 border border-slate-600/50 shadow-sm"
                                >
                                    <Mail size={14} /> Send Email
                                </button> */}
                            </div>
                        </div>
                    </section>

                    {/* Revenue Intelligence Card */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Revenue Intelligence</h3>
                            <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-lg">
                                <DollarSign size={14} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Earned</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-50">{formatters.formatCurrency(earned)}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pipeline</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-400">{formatters.formatCurrency(pipeline)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                    <span className="text-slate-500">Revenue Contribution</span>
                                    <span className="text-emerald-400">{totalValue > 0 ? Math.round((earned / totalValue) * 100) : 0}%</span>
                                </div>
                                <div className="w-full h-3 bg-slate-800/50 rounded-full flex overflow-hidden border border-slate-700/30">
                                    <div
                                        className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000"
                                        style={{ width: `${totalValue > 0 ? (earned / totalValue) * 100 : 0}%` }}
                                    />
                                    <div
                                        className="h-full bg-blue-500/40 transition-all duration-1000"
                                        style={{ width: `${totalValue > 0 ? (pipeline / totalValue) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-4 border-t border-slate-800/50">
                                <div className="flex-1 bg-slate-950/50 rounded-xl p-3 border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Active Deals</span>
                                    <span className="text-sm font-black text-blue-400">{associatedDeals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length}</span>
                                </div>
                                <div className="flex-1 bg-slate-950/50 rounded-xl p-3 border border-slate-800/50 flex flex-col items-center">
                                    <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Total LTV</span>
                                    <span className="text-sm font-black text-slate-50">{formatters.formatCurrency(totalValue)}</span>
                                </div>
                            </div>
                            {productCount > 0 && (
                                <div className="flex items-center gap-4 pt-4 border-t border-slate-800/50">
                                    <div className="flex-1 bg-slate-950/50 rounded-xl p-3 border border-slate-800/50 flex flex-col items-center">
                                        <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Products Interested</span>
                                        <span className="text-sm font-black text-blue-400">{productCount}</span>
                                    </div>
                                    <div className="flex-1 bg-slate-950/50 rounded-xl p-3 border border-slate-800/50 flex flex-col items-center">
                                        <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Est. Revenue</span>
                                        <span className="text-sm font-black text-emerald-400">{formatters.formatCurrency(productValue)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Associated Deals Section */}
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deals ({associatedDeals.length})</h3>
                        </div>
                        {associatedDeals.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                <Briefcase size={24} className="mx-auto mb-2 opacity-20" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No deals yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {associatedDeals.map(deal => (
                                    <Link
                                        key={deal.id}
                                        to={`../deal/${deal.id}`}
                                        className="block p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="text-xs font-bold text-slate-50 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{deal.name}</h4>
                                            <ExternalLink size={12} className="text-slate-400 group-hover:text-blue-400 transition-all" />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                            <span className="text-emerald-400/80">{formatters.formatCurrency(deal.value)}</span>
                                            <span className="text-slate-500">{deal.stage}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div >
            {/* Task Edit Modal */}
            {
                (editingTask || isCreatingTask) && (
                    <TaskModal
                        task={editingTask}
                        leadId={lead.id}
                        onClose={() => {
                            setEditingTask(null);
                            setIsCreatingTask(false);
                        }}
                        onSuccess={(task) => {
                            if (editingTask) {
                                setAssociatedTasks(associatedTasks.map(t => t.id === task.id ? task : t));
                            } else {
                                setAssociatedTasks([...associatedTasks, task]);
                            }
                        }}
                    />
                )
            }

            {/* Schedule Meeting — page level, so the action never depends on
                which tab happens to be open. */}
            {isSchedulingMeeting && (
                <MeetingModal
                    leadId={lead.id}
                    onClose={() => setIsSchedulingMeeting(false)}
                    onSuccess={() => setMeetingsRefreshKey(k => k + 1)}
                />
            )}

            {/* Log Call — same rule as Schedule Meeting. */}
            {isLoggingCall && (
                <LogCallModal
                    leadId={lead.id}
                    onClose={() => setIsLoggingCall(false)}
                    onSuccess={() => setCallsRefreshKey(k => k + 1)}
                />
            )}

            {/* Create Deal Modal */}
            {
                isCreatingDeal && (
                    <CreateDealModal
                        leadId={lead.id}
                        leadName={getLeadDisplayName(lead)}
                        companyName={lead.company_name}
                        onClose={() => setIsCreatingDeal(false)}
                        onSuccess={(deal) => {
                            setAssociatedDeals([...associatedDeals, deal]);
                        }}
                    />
                )
            }

            {/* Delete Lead Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-slate-100 mb-2">Delete Lead</h2>
                        <p className="text-slate-400 mb-6">
                            Are you sure you want to delete this lead? This will remove all associated deals, notes, activities, tasks, and documents. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteLead}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                                Delete Lead
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <ActivityHistoryDrawer
                isOpen={showActivityDrawer}
                onClose={() => setShowActivityDrawer(false)}
                entityType="lead"
                entityId={lead.id}
            />
            {showLayoutSettings && (
                <LeadLayoutSettingsPanel
                    sections={layoutPrefs.sections}
                    onToggleVisible={layoutPrefs.toggleVisible}
                    onMove={layoutPrefs.moveSection}
                    onReset={layoutPrefs.resetToDefaults}
                    onClose={() => setShowLayoutSettings(false)}
                />
            )}
        </div >
    );
};

export default LeadDetailPage;

