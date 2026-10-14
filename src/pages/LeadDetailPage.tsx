import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { eventBus } from '@so360/event-bus';
import { publishLeadsChanged } from '../utils/leadEvents';
import { useShell, useActivity, useShellBridge, useCurrentEntity } from '@so360/shell-context';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronLeft, Mail, Phone, Building2,
    Calendar, Tag, Clock, Plus,
    LayoutDashboard, Briefcase, CheckCircle2,
    Loader2, ExternalLink, MessageSquare, Users, FileText,
    DollarSign, PieChart, Edit2,
    Trash2, File, Download, UploadCloud, FileIcon, Eye, Package, ShieldCheck, Search, GitMerge
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
import { toast, useConfirm, DetailPageTemplate, Button, Badge, Card, ConfirmDialog, EmptyState } from '@so360/design-system';
import { ClickToCallButton } from '../components/common/ClickToCallButton';
import { Trophy, Zap, Info, TrendingUp, RefreshCw } from 'lucide-react';
import CreateDealModal from './components/CreateDealModal';
import TaskModal from './components/TaskModal';
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
import { MergeLeadPanel } from '../components/leads/MergeLeadPanel';
import { DuplicateLeadWarning } from '../components/leads/DuplicateLeadWarning';
import { parseDuplicateLead, type DuplicateLeadInfo } from '../services/leadDedupService';

type TabType = 'overview' | 'activity' | 'notes' | 'tasks' | 'documents' | 'products' | 'feedback' | 'calls' | 'audit' | 'stakeholders' | 'emails' | 'meetings';

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

// Task 8a7f43ff: the Notes tab lists the newest note first. The lead payload
// embeds notes oldest-first (crm-be orders created_at ASC so reply threads nest
// chronologically), so sort top-level notes here. Reversing before the stable
// sort keeps later-inserted notes first when timestamps tie.
export const sortNotesNewestFirst = <T extends { created_at?: string }>(notes: T[]): T[] => {
    const time = (n: T) => {
        const t = n.created_at ? Date.parse(n.created_at) : NaN;
        return Number.isNaN(t) ? 0 : t;
    };
    return [...notes].reverse().sort((a, b) => time(b) - time(a));
};

// Notes timeline redesign (Task dfae6177): collapse consecutive replies from
// the same author into one run so the author/timestamp header only prints
// once per run instead of once per reply.
const groupConsecutiveReplies = <T extends { author?: { id?: string; full_name?: string } | null }>(replies: T[]): T[][] => {
    const runs: T[][] = [];
    replies.forEach((reply) => {
        const lastRun = runs[runs.length - 1];
        const lastReply = lastRun?.[lastRun.length - 1];
        const sameAuthor = lastReply && (lastReply.author?.id ?? lastReply.author?.full_name) === (reply.author?.id ?? reply.author?.full_name);
        if (lastRun && sameAuthor) {
            lastRun.push(reply);
        } else {
            runs.push([reply]);
        }
    });
    return runs;
};

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
    const [confirm, confirmDialog] = useConfirm();
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
    // A6 merge: the kept lead is updated and the other one removed, so require
    // both update and delete rights. Fail closed.
    const canMergeLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.update') ?? false) && (shell?.hasPermission?.('leads.delete') ?? false);
    // Lead Detail activity toolbar — gated per-action so an Admin can grant each
    // independently via Settings > Roles & Permissions instead of the buttons
    // being visible to every role by default. Backend already enforces the same
    // codes (notes/calls/meetings/crm_tasks/crm_documents controllers, and
    // messages.create in Inbox for Send Email) — this only controls visibility.
    const canAddNote = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('notes.create') ?? false);
    const canSendEmail = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('messages.create') ?? false);
    const canLogCall = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('crm_calls.create') ?? false);
    const canScheduleMeeting = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('meetings.create') ?? false);
    const canCreateTask = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('crm_tasks.create') ?? false);
    const canUploadDocument = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('crm_documents.create') ?? false);
    const canUseNeuraAi = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('submodule:crm:neura_ai_copilot') ?? false);
    const isDailyStoreEnabled = isModuleEnabled('dailystore');
    const isInboxEnabled = isModuleEnabled('inbox');
    const isCustomerDetailRoute = location.pathname.includes('/customers/');
    const backLabel = isCustomerDetailRoute ? 'Back to Customers' : 'Back to Leads';
    const backRoute = isCustomerDetailRoute ? '/crm/customers' : '/crm/leads';
    const [lead, setLead] = useState<Lead | null>(null);
    const [isMergeOpen, setIsMergeOpen] = useState(false);
    const [saveDuplicate, setSaveDuplicate] = useState<DuplicateLeadInfo | null>(null);
    const [associatedDeals, setAssociatedDeals] = useState<Deal[]>([]);
    const [associatedTasks, setAssociatedTasks] = useState<Task[]>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [scoringRules, setScoringRules] = useState<LeadScoringRule[]>([]);
    const [scoreCategories, setScoreCategories] = useState<import('../types/crm').ScoreCategory[]>([]);
    const [isRecalculatingScore, setIsRecalculatingScore] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [infoTab, setInfoTab] = useState<'profile' | 'additional' | 'business'>('profile');
    const [isLoading, setIsLoading] = useState(true);
    /** True when the lead fetch returned 403 — distinct from the lead not existing. */
    const [accessDenied, setAccessDenied] = useState(false);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    // Editing a lead ran the same fields through no validation at all, so a
    // name or phone rejected by Create Lead could still be saved from here.
    const [editErrors, setEditErrors] = useState<Record<string, string | null>>({});
    // Guards the profile Save against double clicks firing overlapping PATCHes.
    const [isSavingInfo, setIsSavingInfo] = useState(false);
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
    // Notes timeline redesign (Task dfae6177): reply composer is collapsed
    // behind a "Reply" affordance per note, opened on demand.
    const [openReplyNoteId, setOpenReplyNoteId] = useState<string | null>(null);
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

    // Resolves true when the lead was loaded, false when that load failed (the
    // failure is still handled/logged here). Existing callers ignore the result.
    const fetchLeadData = useCallback(async (): Promise<boolean> => {
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
            return true;
        } catch (error) {
            console.error('Failed to fetch lead data', error);
            // Report a permission failure as a permission failure. Reusing the
            // "not found" state for this sent users hunting for a deleted record
            // instead of asking an administrator for access.
            setAccessDenied((error as { status?: number })?.status === 403);
            return false;
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
            <DetailPageTemplate title="Loading lead workspace..." loading />
        );
    }

    if (accessDenied) {
        return (
            <EmptyState
                title="You don't have permission to view this lead."
                description="Ask an administrator to grant your role access to CRM leads."
                action={{ label: backLabel, onClick: () => navigate(backRoute) }}
            />
        );
    }

    if (!lead) {
        return (
            <EmptyState
                title="Lead not found."
                action={{ label: backLabel, onClick: () => navigate(backRoute) }}
            />
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
            // Server-confirmed: every lead-derived count re-reads from here.
            publishLeadsChanged('deleted', [id]);
            // The delete is a soft delete, so "Undo" is a real restore rather
            // than a re-create — the lead comes back with its history intact.
            toast.success('Lead deleted', {
                duration: 8000,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        crmService.restoreLead(id)
                            .then(() => {
                                publishLeadsChanged('restored', [id]);
                                toast.success('Lead restored');
                            })
                            .catch((e: any) => toast.error(describeApiError(e, 'We couldn’t restore this lead.')));
                    },
                },
            });
            recordActivity({ eventType: 'lead.deleted', eventCategory: 'crm', description: `Deleted lead "${leadName}"`, resourceType: 'lead', resourceId: id }).catch(() => {});
            navigate(isCustomerDetailRoute ? '/crm/customers' : '/crm/leads');
        } catch (error: any) {
            // Never the raw router text ("Cannot DELETE /leads/<id>") — that is
            // exactly what users were shown when this route did not exist.
            toast.error(describeApiError(error, 'We couldn’t delete this lead. Please try again.'));
            setIsDeleting(false);
        }
    };

    const statusTone = lead.status === 'Converted' ? 'success' : lead.status === 'Lost' ? 'danger' : 'primary';
    const statusNode = isChangingStatus ? (
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
                                        className="bg-surface border border-line text-xs font-medium text-fg rounded-nb px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                    >
                                        {leadStages.map(stage => (
                                            <option key={stage.id} value={stage.id}>{stage.name}</option>
                                        ))}
                                    </select>
    ) : (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsChangingStatus(true)}>
            <Badge tone={statusTone}>{lead.status}</Badge>
            {lead.type === 'partner' && <Badge tone="primary">Partner</Badge>}
            <Edit2 size={12} className="text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );

    // Overview first, Activity last (Comb DetailPageTemplate tab order); the
    // middle tabs keep the user's saved layout order/visibility.
    const detailTabs = [
        { id: 'overview', label: 'Overview' },
        ...layoutPrefs.visibleSections
            .filter((section) => section.key !== 'activity' && TAB_CONFIG[section.key])
            .map((section) => ({ id: section.key, label: String(TAB_CONFIG[section.key].label(tabCounts)).trim() })),
        ...(layoutPrefs.visibleSections.some((section) => section.key === 'activity') ? [{ id: 'activity', label: 'Activity' }] : []),
    ];

    const recentActivity = entityTimeline.events.slice(0, 3);

    return (
        <>
            {confirmDialog}
            <DetailPageTemplate
                title={getLeadDisplayName(lead)}
                meta={
                    <span className="flex items-center gap-2 text-fg-subtle">
                        <Building2 size={16} className="text-fg-muted" />
                        {lead.company_name}
                    </span>
                }
                status={statusNode}
                onBack={() => (window.history.length > 1 ? navigate(-1) : navigate(backRoute))}
                backLabel={backLabel}
                primaryAction={canCreateDeal ? (
                    <Button onClick={() => setIsCreatingDeal(true)}><Plus size={16} />
                        Create Deal
                    </Button>
                ) : undefined}
                secondaryActions={canMergeLead && !isCustomerDetailRoute ? [
                    <Button
                        key="merge"
                        variant="secondary"
                        onClick={() => setIsMergeOpen(true)}
                        aria-label="Merge"
                        title="Merge a duplicate lead into this one"
                    ><GitMerge size={16} />
                        Merge
                    </Button>,
                ] : undefined}
                overflowActions={[
                    { label: 'Layout settings', onSelect: () => setShowLayoutSettings(true) },
                    ...(canDeleteLead ? [{ label: 'Delete', danger: true, onSelect: () => setShowDeleteConfirm(true) }] : []),
                ]}
                tabs={detailTabs}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab as TabType)}
                sidePanel={
                    <div className="flex flex-col gap-nb-3">
                        {/* 1. Owner */}
                        <Card
                            title="Assigned owner"
                            actions={
                                <Button variant="secondary" type="button" onClick={() => setIsChangingOwner(!isChangingOwner)}>
                                    {isChangingOwner ? 'Cancel' : 'Change'}
                                </Button>
                            }
                        >
                            {isChangingOwner ? (
                                <div className="flex max-h-48 flex-col gap-nb-1 overflow-y-auto">
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
                                            className={`flex w-full items-center gap-nb-3 rounded-nb border p-2 text-left transition-colors ${lead.owner && user.id === lead.owner.id ? 'border-primary bg-primary/10' : 'border-line bg-surface hover:bg-surface-raised'}`}
                                        >
                                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised text-xs font-medium text-fg">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                                                ) : (
                                                    user.full_name?.charAt(0)
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-fg">{user.full_name}</p>
                                                <p className="truncate text-xs text-fg-muted">{user.email}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : lead.owner ? (
                                <div className="flex items-center gap-nb-3">
                                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-raised text-sm font-medium text-fg">
                                        {lead.owner.avatar_url ? (
                                            <img src={lead.owner.avatar_url} alt={lead.owner.full_name} className="h-full w-full object-cover" />
                                        ) : (
                                            lead.owner.full_name?.charAt(0)
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-fg">{lead.owner.full_name}</p>
                                        <p className="truncate text-xs text-fg-muted">{lead.owner.email}</p>
                                    </div>
                                </div>
                            ) : (
                                <EmptyState icon={Users} title="Unassigned" description="Choose Change to assign an owner." />
                            )}
                        </Card>

                        {/* 2. Stage / status */}
                        <Card
                            title={isCustomerDetailRoute ? 'CRM stage' : 'Lead stage'}
                            actions={!isCustomerDetailRoute ? (
                                <Button variant="secondary" type="button" onClick={() => setIsChangingStage(!isChangingStage)}>
                                    {isChangingStage ? 'Cancel' : 'Change'}
                                </Button>
                            ) : undefined}
                        >
                            {isCustomerDetailRoute ? (
                                <>
                                    <div className="flex items-center justify-between gap-nb-3">
                                        <div>
                                            <span className="block text-xs text-fg-muted">Stage</span>
                                            <p className="text-sm font-medium text-fg">Customer</p>
                                        </div>
                                        <Badge tone="neutral" size="sm">Locked</Badge>
                                    </div>
                                    <p className="mt-2 text-xs text-fg-muted">Assign to a CRM pipeline from the pipeline view.</p>
                                </>
                            ) : isChangingStage ? (
                                <div className="flex flex-col gap-nb-1">
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
                                            className={`flex w-full items-center justify-between rounded-nb border px-3 py-2 text-sm transition-colors ${stage.name === lead.status
 ? 'border-primary bg-primary/10 text-primary'
 : 'border-line bg-surface text-fg hover:bg-surface-raised'
 }`}
                                        >
                                            <span>{stage.name}</span>
                                            {stage.name === lead.status && <CheckCircle2 size={14} />}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    className="flex cursor-pointer items-center justify-between gap-nb-3"
                                    onClick={() => setIsChangingStage(true)}
                                >
                                    <div>
                                        <span className="block text-xs text-fg-muted">Status</span>
                                        <p className="text-sm font-medium text-fg">{lead.status}</p>
                                    </div>
                                    <Badge tone={lead.status === 'Converted' ? 'success' : lead.status === 'Lost' ? 'danger' : 'primary'} size="sm">
                                        <TrendingUp size={12} />
                                    </Badge>
                                </div>
                            )}
                            <div className="mt-nb-3 border-t border-line pt-nb-3">
                                <Button variant="secondary" onClick={() => setIsCreatingTask(true)}>
                                    <Clock size={14} /> Schedule follow-up
                                </Button>
                            </div>
                        </Card>

                        {/* 3. Value / revenue */}
                        <Card title="Revenue intelligence">
                            <div className="grid grid-cols-2 gap-nb-3">
                                <div>
                                    <span className="block text-xs text-fg-muted">Earned</span>
                                    <span className="text-lg font-semibold text-fg">{formatters.formatCurrency(earned)}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-fg-muted">Pipeline</span>
                                    <span className="text-lg font-semibold text-fg">{formatters.formatCurrency(pipeline)}</span>
                                </div>
                            </div>
                            <div className="mt-nb-3">
                                <div className="mb-1 flex justify-between text-xs">
                                    <span className="text-fg-muted">Revenue contribution</span>
                                    <span className="text-fg">{totalValue > 0 ? Math.round((earned / totalValue) * 100) : 0}%</span>
                                </div>
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                                    <div className="h-full bg-success" style={{ width: `${totalValue > 0 ? (earned / totalValue) * 100 : 0}%` }} />
                                    <div className="h-full bg-primary/40" style={{ width: `${totalValue > 0 ? (pipeline / totalValue) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <dl className="mt-nb-3 grid grid-cols-2 gap-nb-3 border-t border-line pt-nb-3">
                                <div>
                                    <dt className="text-xs text-fg-muted">Active deals</dt>
                                    <dd className="text-sm font-medium text-fg">{associatedDeals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-fg-muted">Total LTV</dt>
                                    <dd className="text-sm font-medium text-fg">{formatters.formatCurrency(totalValue)}</dd>
                                </div>
                                {productCount > 0 && (
                                    <>
                                        <div>
                                            <dt className="text-xs text-fg-muted">Products interested</dt>
                                            <dd className="text-sm font-medium text-fg">{productCount}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-fg-muted">Est. revenue</dt>
                                            <dd className="text-sm font-medium text-fg">{formatters.formatCurrency(productValue)}</dd>
                                        </div>
                                    </>
                                )}
                            </dl>
                        </Card>

                        {/* 4. Neura summary */}
                        {canUseNeuraAi && (
                            <NeuraAiSummaryCard
                                leadId={lead.id}
                                leadLabel={lead.company_name || getLeadDisplayName(lead)}
                                isInboxEnabled={isInboxEnabled}
                            />
                        )}

                        {/* 5. Recent activity */}
                        <div data-testid="recent-activity-rail">
                            <Card
                                title="Recent activity"
                                actions={<Button variant="secondary" onClick={() => setActiveTab('activity')}>View all</Button>}
                            >
                                {recentActivity.length === 0 ? (
                                    <EmptyState icon={Clock} title="No activities logged yet" />
                                ) : (
                                    <ul className="divide-y divide-line">
                                        {recentActivity.map((event) => (
                                            <li key={event.id} className="py-2 text-sm text-fg first:pt-0 last:pb-0">
                                                <span className="block truncate">{event.title}</span>
                                                <span className="text-xs text-fg-muted">{formatters.formatDate(event.created_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>

                        {/* Potential score */}
                        <Card
                            title={isCustomerDetailRoute ? 'Customer potential' : 'Lead potential'}
                            actions={!isCustomerDetailRoute ? (
                                <Button
                                    variant="secondary"
                                    onClick={handleRecalculateScore}
                                    disabled={isRecalculatingScore}
                                    title="Recalculate score"
                                    aria-label="Recalculate score"
                                >
                                    <RefreshCw size={12} className={isRecalculatingScore ? 'animate-spin' : ''} />
                                </Button>
                            ) : undefined}
                        >
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
                                        <div className="flex items-baseline gap-nb-2">
                                            <span className="text-3xl font-semibold text-fg">{engagementScore}</span>
                                            <span className="text-xs text-fg-muted">Engagement / 100</span>
                                        </div>
                                        <div className="mt-nb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                                            <div className="h-full bg-primary transition-all" style={{ width: `${engagementScore}%` }} />
                                        </div>
                                        <div className="mt-nb-3 border-t border-line pt-nb-3">
                                            {engagementBreakdown.length === 0 ? (
                                                <p className="text-sm text-fg-muted">No engagement data yet</p>
                                            ) : (
                                                <ul className="divide-y divide-line">
                                                    {engagementBreakdown.map((item, idx) => (
                                                        <li key={idx} className="flex items-center justify-between py-1.5 text-sm">
                                                            <span className="text-fg-muted">{item.label}</span>
                                                            <span className="text-success">+{item.points}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </>
                                );
                            })() : (
                                <>
                                    <div className="flex items-baseline gap-nb-2">
                                        <span className="text-3xl font-semibold text-fg">{score}</span>
                                        <span className="text-xs text-fg-muted">Score</span>
                                        <span
                                            className="ml-auto rounded-nb px-2 py-0.5 text-xs font-medium"
                                            style={{ color: scoreCategory.color, backgroundColor: `${scoreCategory.color}20` }}
                                        >
                                            {scoreCategory.label}
                                        </span>
                                    </div>
                                    <div className="mt-nb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                                        <div
                                            className="h-full transition-all"
                                            style={{ width: `${Math.min(100, (score / 150) * 100)}%`, backgroundColor: scoreCategory.color }}
                                        />
                                    </div>
                                    <div className="mt-nb-3 border-t border-line pt-nb-3">
                                        {breakdown.length === 0 ? (
                                            scoringRules.filter(r => r.is_active).length === 0 ? (
                                                <p className="text-sm text-fg-muted">No active scoring rules configured</p>
                                            ) : (
                                                <div className="flex items-center justify-between gap-nb-2">
                                                    <p className="text-sm text-fg-muted">0 of {scoringRules.filter(r => r.is_active).length} rules matched</p>
                                                    <Button variant="secondary" onClick={handleRecalculateScore} disabled={isRecalculatingScore}>
                                                        <RefreshCw size={12} className={isRecalculatingScore ? 'animate-spin' : ''} />
                                                        Recalculate
                                                    </Button>
                                                </div>
                                            )
                                        ) : (
                                            <>
                                                <p className="mb-1 text-xs text-fg-muted">Matched rules</p>
                                                <ul className="divide-y divide-line">
                                                    {breakdown.map((item, idx) => (
                                                        <li key={idx} className="flex items-center justify-between py-1.5 text-sm">
                                                            <span className="mr-2 flex min-w-0 items-center gap-1.5 text-fg">
                                                                <span className="shrink-0 text-success">✓</span>
                                                                <span className="truncate">{item.label}</span>
                                                            </span>
                                                            <span className={item.points >= 0 ? 'shrink-0 text-success' : 'shrink-0 text-danger'}>
                                                                {item.points >= 0 ? '+' : ''}{item.points}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </Card>

                        {/* Deals */}
                        <Card title={`Deals (${associatedDeals.length})`}>
                            {associatedDeals.length === 0 ? (
                                <EmptyState icon={Briefcase} title="No deals yet" />
                            ) : (
                                <ul className="divide-y divide-line">
                                    {associatedDeals.map(deal => (
                                        <li key={deal.id}>
                                            <Link
                                                to={`../deal/${deal.id}`}
                                                className="group block py-2 first:pt-0 last:pb-0"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <h4 className="text-sm font-medium text-fg group-hover:text-primary">{deal.name}</h4>
                                                    <ExternalLink size={12} className="text-fg-subtle group-hover:text-primary" />
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-success">{formatters.formatCurrency(deal.value)}</span>
                                                    <span className="text-fg-muted">{deal.stage}</span>
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                }
            >
            {saveDuplicate && (
                <div className="mb-6">
                    <DuplicateLeadWarning
                        duplicate={saveDuplicate}
                        onCancel={() => {
                            // Back out of the conflicting edit: drop the warning,
                            // leave edit mode and reload the saved values.
                            setSaveDuplicate(null);
                            setIsEditingInfo(false);
                            fetchLeadData();
                        }}
                    />
                </div>
            )}

            {isMergeOpen && (
                <MergeLeadPanel
                    keepLead={lead}
                    onClose={() => setIsMergeOpen(false)}
                    onMerged={(mergedId) => {
                        setIsMergeOpen(false);
                        publishLeadsChanged('deleted', [mergedId]);
                        fetchLeadData();
                    }}
                />
            )}


                {activeTab === 'overview' && (
                    <div className="flex flex-col gap-nb-3">
            {/* Lead Journey Stepper — only for leads, not customers */}
            {!isCustomerDetailRoute && (
                <Card title="Lead journey">
                    <LeadJourneyStepper currentState={(lead as any).current_flow_state || lead.status} />
                </Card>
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
                canAddNote={canAddNote}
                canSendEmail={canSendEmail}
                canLogCall={canLogCall}
                canScheduleMeeting={canScheduleMeeting}
                canCreateTask={canCreateTask}
                canUploadDocument={canUploadDocument}
            />
            {/* Executive Summary Dashboard */}
            <ExecutiveSummaryPanel
                lead={lead}
                deals={associatedDeals}
                tasks={associatedTasks}
            />
                    {/* Lead Information Tabs Card */}
                    <Card padding="none" className="overflow-hidden">
                        <div className="flex border-b border-line bg-surface">
                            <button
                                onClick={() => setInfoTab('profile')}
                                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all ${infoTab === 'profile' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-fg-muted hover:text-fg-subtle'}`}
                            >
                                <Users size={14} /> Full Profile
                            </button>
                            {customFieldDefs.length > 0 && (
                                <button
                                    onClick={() => setInfoTab('additional')}
                                    className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all ${infoTab === 'additional' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-fg-muted hover:text-fg-subtle'}`}
                                >
                                    <Info size={14} /> Additional Info
                                </button>
                            )}
                            <button
                                onClick={() => setInfoTab('business')}
                                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all ${infoTab === 'business' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-fg-muted hover:text-fg-subtle'}`}
                            >
                                <Building2 size={14} /> Business Profile
                            </button>
                            <div className="ml-auto flex items-center px-4">
                                <button
                                    disabled={isSavingInfo}
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
                                            setIsSavingInfo(true);
                                            try {
                                                // Field-diff history is now captured server-side by the
                                                // leads audit trigger (Task 7) — see the Audit History tab.
                                                await crmService.updateLead(lead.id, lead);
                                                setSaveDuplicate(null);
                                                recordActivity({ eventType: 'lead.updated', eventCategory: 'crm', description: `Updated lead "${getLeadDisplayName(lead)}"`, resourceType: 'lead', resourceId: lead.id }).catch(() => {});
                                                // Leave edit mode only once the persisted lead is back on
                                                // screen, so what the user sees is what the server stored.
                                                const reloaded = await fetchLeadData();
                                                if (!reloaded) {
                                                    // Saved, but the persisted lead could not be re-read. Keep
                                                    // the editor open with the user's values rather than showing
                                                    // them as if they were the stored record.
                                                    toast.error('Changes were saved, but the latest lead could not be reloaded. Your edits are still shown; please refresh to confirm.');
                                                    return;
                                                }
                                            } catch (error) {
                                                console.error('Failed to save lead info', error);
                                                const dup = parseDuplicateLead(error);
                                                if (dup) {
                                                    setSaveDuplicate(dup);
                                                    return;
                                                }
                                                const status = (error as { status?: number })?.status;
                                                const message = (error as Error)?.message;
                                                toast.error(
                                                    status && status >= 400 && status < 500 && message
                                                        ? message
                                                        : 'Failed to save changes.',
                                                );
                                                return;
                                            } finally {
                                                setIsSavingInfo(false);
                                            }
                                        }
                                        setIsEditingInfo(!isEditingInfo);
                                    }}
                                    className={`p-2 rounded-nb transition-all disabled:opacity-60 disabled:cursor-wait ${isEditingInfo ? 'bg-primary text-fg ' : 'text-fg-muted hover:text-fg-subtle hover:bg-surface-raised'}`}
                                    title={isSavingInfo ? 'Saving…' : isEditingInfo ? "Save Changes" : "Edit Intelligence"}
                                    aria-busy={isSavingInfo}
                                >
                                    {isSavingInfo ? <Loader2 size={16} className="animate-spin" /> : isEditingInfo ? <CheckCircle2 size={16} /> : <Edit2 size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="p-4">
                            {infoTab === 'profile' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-fg-subtle">
                                                <Users size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">First Name</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        type="text"
                                                        value={lead.first_name || ''}
                                                        onChange={(e) => {
                                                            setLead({ ...lead, first_name: e.target.value });
                                                            setEditErrors(prev => ({ ...prev, first_name: validateFirstNameRequired(e.target.value) }));
                                                        }}
                                                        aria-invalid={!!editErrors.first_name}
                                                        className={`bg-bg border text-sm font-medium text-fg rounded px-2 py-1 outline-none ${editErrors.first_name ? 'border-danger' : 'border-line focus:border-primary'}`}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">{lead.first_name || '—'}</span>
                                                )}
                                                {isEditingInfo && editErrors.first_name && (
                                                    <p className="text-xs text-danger mt-1">{editErrors.first_name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-fg-subtle">
                                                <Users size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">Last Name</span>
                                                {isEditingInfo ? (
                                                    <input
                                                        type="text"
                                                        value={lead.last_name || ''}
                                                        onChange={(e) => {
                                                            setLead({ ...lead, last_name: e.target.value });
                                                            setEditErrors(prev => ({ ...prev, last_name: validateLastName(e.target.value) }));
                                                        }}
                                                        aria-invalid={!!editErrors.last_name}
                                                        className={`bg-bg border text-sm font-medium text-fg rounded px-2 py-1 outline-none ${editErrors.last_name ? 'border-danger' : 'border-line focus:border-primary'}`}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">{lead.last_name || '—'}</span>
                                                )}
                                                {isEditingInfo && editErrors.last_name && (
                                                    <p className="text-xs text-danger mt-1">{editErrors.last_name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary">
                                                <Mail size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">Email</span>
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
                                                        className={`bg-bg border text-sm font-medium text-fg rounded px-2 py-1 outline-none ${editErrors.contact_email ? 'border-danger' : 'border-line focus:border-primary'}`}
                                                    />
                                                ) : (
                                                    <a href={`mailto:${lead.contact_email}`} className="text-sm font-medium hover:text-primary transition-colors">{lead.contact_email}</a>
                                                )}
                                                {isEditingInfo && editErrors.contact_email && (
                                                    <p className="text-xs text-danger mt-1">{editErrors.contact_email}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary">
                                                <Phone size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">Phone</span>
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
                                                        className={`bg-bg border text-sm font-medium text-fg rounded px-2 py-1 outline-none ${editErrors.phone ? 'border-danger' : 'border-line focus:border-primary'}`}
                                                    />
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{lead.phone || 'Not provided'}</span>
                                                        <ClickToCallButton
                                                            number={lead.phone}
                                                            entityType={isCustomerDetailRoute ? 'contact' : 'lead'}
                                                            entityId={lead.id}
                                                            name={getLeadDisplayName(lead)}
                                                        />
                                                    </span>
                                                )}
                                                {isEditingInfo && editErrors.phone && (
                                                    <p className="text-xs text-danger mt-1">{editErrors.phone}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-success">
                                                <Tag size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">Source</span>
                                                {isEditingInfo ? (
                                                    <select
                                                        value={lead.source}
                                                        onChange={(e) => setLead({ ...lead, source: e.target.value })}
                                                        className="bg-bg border border-line text-sm font-medium text-fg rounded px-2 py-1 outline-none focus:border-primary"
                                                    >
                                                        <option value="">— Select source —</option>
                                                        {sourceTypes.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm font-medium">
                                                        {sourceTypes.find(o => o.value === lead.source)?.label ?? lead.source}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary">
                                                <Users size={18} />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">Referred By</span>
                                                {isEditingInfo ? (
                                                    <PartnerSearchDropdown
                                                        partners={partners}
                                                        value={lead.referred_by || ''}
                                                        onChange={(id) => setLead({ ...lead, referred_by: id || undefined })}
                                                        placeholder="Search and select partner..."
                                                        inputClassName="text-sm font-bold"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">
                                                        {partners.find(p => p.id === lead.referred_by)?.company_name || '—'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isEditingInfo && (
                                            <div className="flex items-center gap-4 text-fg-subtle">
                                                <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary">
                                                    <Users size={18} />
                                                </div>
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-xs font-medium text-fg-muted mb-0.5">Partner</span>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={lead.type === 'partner'}
                                                            onChange={(e) => setLead({ ...lead, type: e.target.checked ? 'partner' : 'lead' })}
                                                            className="w-4 h-4 rounded accent-primary"
                                                        />
                                                        <span className="text-sm font-medium">Mark as Partner</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-fg-subtle text-opacity-50">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-warning opacity-50">
                                                <Calendar size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">Created</span>
                                                <span className="text-sm font-medium">{formatters.formatDate(lead.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {infoTab === 'additional' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                    {customFieldDefs.map(field => (
                                        <div key={field.id} className="flex items-center gap-4 text-fg-subtle">
                                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-fg-muted">
                                                {field.type === 'date' ? <Calendar size={18} /> : field.type === 'boolean' ? <CheckCircle2 size={18} /> : <Tag size={18} />}
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="text-xs font-medium text-fg-muted mb-0.5">{field.label}</span>
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
                                                        className="bg-bg border border-line text-sm font-medium text-fg rounded px-2 py-1 outline-none focus:border-primary"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">
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
                    </Card>
                    </div>
                )}

                {activeTab !== 'overview' && (
                    <div ref={workspaceRef} className="space-y-4 scroll-mt-6" data-testid="detail-workspace">
                        <div className="flex flex-col gap-nb-3">
                            {activeTab === 'activity' && (
                                <Card
                                    title="Customer timeline"
                                    actions={
                                        <div className="flex items-center gap-nb-2">
                                            <div className="relative">
                                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
                                                <input
                                                    value={commSearchQuery}
                                                    onChange={(e) => setCommSearchQuery(e.target.value)}
                                                    placeholder="Search notes, tasks, deals…"
                                                    aria-label="Search notes, tasks, deals"
                                                    className="h-nb-control-md w-48 rounded-nb border border-line bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-primary wc-medium:w-64"
                                                />
                                            </div>
                                            <Button variant="secondary" onClick={() => setShowActivityDrawer(true)}>
                                                <ExternalLink size={12} /> View all history
                                            </Button>
                                        </div>
                                    }
                                >
                                <div className="space-y-6">
                                    {commSearchQuery.trim() && (
                                        <div className="max-h-64 overflow-y-auto rounded-nb border border-line divide-y divide-line">
                                            {commSearchResults.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-fg-muted">No matches.</p>
                                            ) : (
                                                commSearchResults.map((r) => (
                                                    <button
                                                        key={r.id}
                                                        onClick={() => { setActiveTab(r.tab); setCommSearchQuery(''); }}
                                                        className="w-full px-3 py-2 text-left transition-colors hover:bg-surface-raised"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium text-fg-muted">{r.kind}</span>
                                                            <span className="text-xs text-fg-muted">{formatters.formatDate(r.date)}</span>
                                                        </div>
                                                        <p className="truncate text-sm text-fg">{r.title}</p>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* AI/health summary */}
                                    {entityTimeline.summary && <TimelineSummaryBanner summary={entityTimeline.summary} />}

                                    {/* Timeline */}
                                    <div className="space-y-3 relative">
                                        {entityTimeline.loading ? (
                                            <div className="flex items-center justify-center py-8 text-fg-muted">
                                                <Loader2 size={18} className="animate-spin" />
                                            </div>
                                        ) : entityTimeline.events.length === 0 ? (
                                            <EmptyState title="No activities logged yet" description="Activities appear here automatically when users interact with this record." />
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
                                                        if (await confirm({ title: 'Delete?', message: 'Delete this activity?', intent: 'danger', confirmLabel: 'Delete' }) && e.related_id) {
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
                                            <Button
                                                variant="secondary"
                                                onClick={entityTimeline.loadMore}
                                                disabled={entityTimeline.loadingMore}
                                            >
                                                {entityTimeline.loadingMore ? 'Loading…' : 'Load more'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                </Card>
                            )}
                            {activeTab === 'notes' && (
                                <Card title="Notes">
                                    <div className="flex flex-col gap-nb-3">
                                        {lead.notes.length === 0 ? (
                                            <EmptyState title="No notes yet" description={`Notes captured for this ${isCustomerDetailRoute ? 'customer' : 'lead'} will appear here.`} />
                                        ) : (
                                            <div className="divide-y divide-line">
                                                {sortNotesNewestFirst(lead.notes).map(note => (
                                                    <div key={note.id} className="text-sm py-nb-3 first:pt-0 group/note relative">
                                                        {editingNoteId === note.id ? (
                                                            <div className="mb-2">
                                                                <NoteEditor value={editingNoteContent} onChange={setEditingNoteContent} autoFocus />
                                                                <div className="flex justify-end gap-2 mt-3">
                                                                    <Button
                                                                        variant="secondary"
                                                                        onClick={() => setEditingNoteId(null)}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        variant="primary"
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
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="absolute right-0 top-nb-3 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-2">
                                                                    <button
                                                                        aria-label="Edit note"
                                                                        data-testid={`edit-note-${note.id}`}
                                                                        onClick={() => {
                                                                            setEditingNoteId(note.id);
                                                                            setEditingNoteContent(note.content);
                                                                        }}
                                                                        className="text-fg-muted hover:text-primary"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button
                                                                        aria-label="Delete note"
                                                                        data-testid={`delete-note-${note.id}`}
                                                                        onClick={async () => {
                                                                            if (await confirm({ title: 'Delete?', message: 'Delete this note?', intent: 'danger', confirmLabel: 'Delete' })) {
                                                                                await crmService.deleteNote(note.id);
                                                                                setLead({
                                                                                    ...lead,
                                                                                    notes: lead.notes.filter(n => n.id !== note.id)
                                                                                });
                                                                            }
                                                                        }}
                                                                        className="text-fg-muted hover:text-danger"
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
                                                            <span className="text-xs font-medium text-fg-muted">{note.author.full_name}</span>
                                                            <span className="text-xs text-fg-subtle font-medium">{formatters.formatDate(note.created_at)}</span>
                                                        </div>

                                                        {(note.replies || []).length > 0 && (
                                                            <div className="mt-3 ml-3 space-y-3 border-l-2 border-line pl-4">
                                                                {groupConsecutiveReplies(note.replies || []).map((run) => (
                                                                    <div key={run[0].id} className="space-y-1.5">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs font-medium text-fg-muted">{run[0].author?.full_name}</span>
                                                                            <span className="text-xs text-fg-muted font-medium">{formatters.formatDate(run[0].created_at)}</span>
                                                                        </div>
                                                                        {run.map((reply) => (
                                                                            <div key={reply.id} className="text-sm">
                                                                                <NoteContent html={reply.content} />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="mt-3 ml-3 pl-4">
                                                            {openReplyNoteId === note.id ? (
                                                                <NoteReplyComposer
                                                                    people={allUsers}
                                                                    onSubmit={async (content) => {
                                                                        const freshReply = await crmService.createNote({ lead_id: lead.id, content, parent_note_id: note.id });
                                                                        setLead({
                                                                            ...lead,
                                                                            notes: lead.notes.map((n) => n.id === note.id ? { ...n, replies: [...(n.replies || []), freshReply] } : n),
                                                                        });
                                                                        setOpenReplyNoteId(null);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    data-testid={`open-reply-${note.id}`}
                                                                    onClick={() => setOpenReplyNoteId(note.id)}
                                                                    className="flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-primary transition-colors"
                                                                >
                                                                    <MessageSquare size={11} /> Reply
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div ref={noteComposerRef} className="border-t border-line pt-nb-3 first:border-t-0 first:pt-0">
                                            <NoteEditor
                                                key={noteEditorKey}
                                                value={newNoteContent}
                                                onChange={setNewNoteContent}
                                                placeholder="Add a private note about this lead..."
                                            />
                                            <div className="flex justify-end mt-3">
                                                <Button
                                                    variant="primary"
                                                    onClick={async () => {
                                                        if (isNoteContentEmpty(newNoteContent)) return;
                                                        const freshNote = await crmService.createNote({ lead_id: lead.id, content: newNoteContent });
                                                        setLead({
                                                            ...lead,
                                                            notes: [freshNote, ...(lead.notes || [])]
                                                        });
                                                        setNewNoteContent('');
                                                        setNoteEditorKey((k) => k + 1);
                                                    }}
                                                    disabled={isNoteContentEmpty(newNoteContent)}
                                                >
                                                    Save note
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'tasks' && (
                                <Card
                                    title="Tasks"
                                    actions={
                                        <Button variant="secondary" onClick={() => setIsCreatingTask(true)}>
                                            <Plus size={12} /> Add task
                                        </Button>
                                    }
                                >
                                <div className="flex flex-col gap-nb-3">
                                    {associatedTasks.some(t => t.type === 'REMINDER' && t.status === 'OPEN' && new Date(t.due_date) <= new Date(new Date().getTime() + 60 * 60 * 1000)) && (
                                                <Badge tone="danger" size="sm">Due reminders</Badge>
                                            )}

                                    {/* Reminders Alert Section */}
                                    {associatedTasks.filter(t => t.type === 'REMINDER' && t.status === 'OPEN' && new Date(t.due_date) <= new Date(new Date().getTime() + 24 * 60 * 60 * 1000)).length > 0 && (
                                        /* Notification strip — deliberately NOT card-shaped, so it
                                           never reads as a second copy of the task below. */
                                        <div data-testid="task-reminders-panel">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock size={12} className="text-warning" />
                                                <h4 className="text-xs font-medium text-warning">
                                                    Upcoming and due reminders
                                                </h4>
                                                <span className="text-xs text-fg-subtle">
                                                    · alerts for tasks already listed below
                                                </span>
                                            </div>
                                            <div className="divide-y divide-warning/10 border-l-2 border-warning bg-warning/5 rounded-r">
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
                                                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-warning/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                                                            >
                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${reminderOverdue ? 'bg-danger animate-pulse' : 'bg-warning'}`} />
                                                                <span className="text-xs font-semibold text-fg-subtle truncate">{task.title}</span>
                                                                <span className={`text-xs shrink-0 ${reminderOverdue ? 'text-danger font-medium' : 'text-fg-subtle'}`}>
                                                                    {reminderOverdue ? 'Overdue · ' : ''}{formatters.formatDateTime(task.due_date)}
                                                                </span>
                                                                <span className="ml-auto text-xs font-medium text-warning shrink-0">
                                                                    View task
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}
                                    {associatedTasks.length === 0 ? (
                                        <EmptyState icon={CheckCircle2} title="No active tasks or follow-ups" description="Use Add task to track the next step." />
                                    ) : (
                                        <div className="divide-y divide-line">
                                            {associatedTasks.map(task => {
                                                const overdue = isTaskOverdue(task.due_date) && task.status !== 'DONE';
                                                return (
                                                <div key={task.id} id={`task-card-${task.id}`} className={`flex items-start gap-nb-3 py-nb-3 first:pt-0 last:pb-0 group relative transition-all ${highlightedTaskId === task.id ? 'ring-2 ring-warning rounded-nb' : ''} ${task.status === 'DONE' ? 'opacity-60' : ''}`}>
                                                    <button
                                                        onClick={() => handleTaskToggle(task)}
                                                        className={`mt-1 w-5 h-5 rounded border transition-colors shrink-0 flex items-center justify-center ${task.status === 'DONE' ? 'bg-success/10 border-success text-success' : 'border-line group-hover:border-primary'}`}
                                                    >
                                                        <CheckCircle2 size={12} className={`transition-opacity ${task.status === 'DONE' ? 'opacity-100' : 'opacity-0 group-hover:opacity-20 text-primary'}`} />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <Link to={`/crm/tasks/${task.id}`} className="block group/link">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className={`text-sm font-medium text-fg leading-tight truncate group-hover/link:text-primary transition-colors ${task.status === 'DONE' ? 'line-through text-fg-muted' : ''}`}>
                                                                    {task.title || 'Untitled task'}
                                                                </h4>
                                                                <div className="flex items-center gap-2">
                                                                    {overdue && (
                                                                        <Badge tone="danger" size="sm" data-testid={`overdue-badge-${task.id}`}>Overdue</Badge>
                                                                    )}
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setExpandedStatusDropdown(expandedStatusDropdown === task.id ? null : task.id);
                                                                            }}
                                                                            className="cursor-pointer"
                                                                            data-testid={`status-button-${task.id}`}
                                                                        >
                                            <Badge size="sm" tone={task.status === 'DONE' ? 'success' : task.status === 'IN_PROGRESS' ? 'info' : 'neutral'}>{task.status}</Badge>
                                        </button>
                                                                        {expandedStatusDropdown === task.id && (
                                                                            <div className="absolute top-full mt-1 right-0 z-10 bg-surface border border-line rounded-nb" data-testid={`status-dropdown-${task.id}`}>
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
                                                                                        className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${task.status === status ? 'bg-primary/20 text-primary border-b border-primary/20' : 'hover:bg-surface-raised text-fg-subtle'}`}
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
                                                                <p className="text-xs text-fg-subtle mt-1 line-clamp-2">{task.description}</p>
                                                            )}
                                                        </Link>

                                                        {/* Metadata row: readable in its own right, one weight below the
                                                            title. The previous muted-grey / pale-red pairing sat under
                                                            3:1 on the light theme's white card. */}
                                                        <div className="flex items-center gap-4 mt-3 text-xs font-medium text-fg-subtle border-t border-line pt-2">
                                                            <span className={`flex items-center gap-1 ${overdue ? 'text-danger' : 'text-fg-subtle'}`}>
                                                                <Clock size={11} />
                                                                Due {formatters.formatDate(task.due_date)}
                                                            </span>

                                                            {task.assigned_to && (
                                                                <span className="flex items-center gap-1 text-fg-subtle">
                                                                    <div className="w-4 h-4 rounded-full bg-surface-raised flex items-center justify-center overflow-hidden border border-line">
                                                                        {task.assigned_to.avatar_url ? <img src={task.assigned_to.avatar_url} alt={task.assigned_to.full_name} className="w-full h-full object-cover" /> : task.assigned_to.full_name?.charAt(0)}
                                                                    </div>
                                                                    {task.assigned_to.full_name}
                                                                </span>
                                                            )}

                                                            {task.deal_name && (
                                                                <>
                                                                    <span className="w-1 h-1 bg-fg-subtle rounded-full" />
                                                                    <span className="text-primary lowercase italic">{task.deal_name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                        <button
                                                            onClick={() => !isTaskLocked(task.status) && setEditingTask(task)}
                                                            disabled={isTaskLocked(task.status)}
                                                            title={isTaskLocked(task.status) ? TASK_LOCKED_HINT : 'Edit task'}
                                                            aria-label="Edit Task"
                                                            className="p-1.5 bg-surface-raised rounded hover:text-primary hover:bg-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-raised disabled:hover:text-current"
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
                                </Card>
                            )}

                            {activeTab === 'documents' && (
                                <Card title="Documents" actions={
<label className={`inline-flex items-center gap-nb-2 h-nb-control-md px-nb-3 rounded-nb border border-line text-sm font-medium cursor-pointer transition-colors ${isUploading ? 'bg-surface-raised text-fg-muted' : 'bg-surface text-fg hover:bg-surface-raised'}`}>
                                            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                            {isUploading ? 'Uploading…' : 'Upload document'}
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
                                }>
                                    {(!lead.documents || lead.documents.length === 0) ? (
                                        <EmptyState icon={FileIcon} title="No documents attached" description="Centralize proposals, contracts, and requirement docs here." />
                                    ) : (
                                        <div className="divide-y divide-line">
                                            {lead.documents.map(doc => (
                                                <div key={doc.id} className="flex items-center gap-nb-3 py-nb-3 first:pt-0 last:pb-0 group">
                                                    <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary shrink-0">
                                                        <File size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-medium text-fg truncate group-hover:text-primary transition-colors">{doc.name}</h4>
                                                        <div className="flex items-center gap-3 mt-1 text-xs font-medium text-fg-subtle">
                                                            <span>{(doc.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                            <span className="w-1 h-1 bg-surface-raised rounded-full" />
                                                            <span>{formatters.formatDate(doc.uploaded_at)}</span>
                                                            <span className="w-1 h-1 bg-surface-raised rounded-full" />
                                                            <span className="text-fg-muted">by {doc.uploaded_by.full_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {doc.dmsDocumentId ? (
                                                            <button
                                                                onClick={() => { void openLeadDocument(doc); }}
                                                                className="p-2 text-fg-muted hover:text-primary hover:bg-surface-raised rounded-nb transition-all"
                                                                title="View"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                        ) : (
                                                            <a
                                                                href={doc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-2 text-fg-muted hover:text-primary hover:bg-surface-raised rounded-nb transition-all"
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
                                                            className="p-2 text-fg-muted hover:text-fg hover:bg-surface-raised rounded-nb transition-all"
                                                            title="Download"
                                                        >
                                                            <Download size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (await confirm({ title: 'Delete?', message: 'Delete this document?', intent: 'danger', confirmLabel: 'Delete' })) {
                                                                    await crmService.deleteDocument(lead.id, doc.id);
                                                                    setLead({
                                                                        ...lead,
                                                                        documents: lead.documents?.filter(d => d.id !== doc.id)
                                                                    });
                                                                    publishLeadDocumentsChanged(lead.id);
                                                                }
                                                            }}
                                                            className="p-2 text-fg-muted hover:text-danger hover:bg-danger/10 rounded-nb transition-all"
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
                                </Card>
                            )}

                            {activeTab === 'products' && lead && (
                                <Card title="Products">
                                    <LeadProductsTab
                                        leadId={lead.id}
                                        onStatsChange={(count, value) => {
                                            setProductCount(count);
                                            setProductValue(value);
                                        }}
                                    />
                                </Card>
                            )}

                            {activeTab === 'feedback' && lead && (
                                <Card title="Feedback">
                                    <CustomerFeedbackTab leadId={lead.id} />
                                </Card>
                            )}

                            {activeTab === 'calls' && lead && (
                                <Card title="Calls">
                                    <CallsTab key={callsRefreshKey} leadId={lead.id} />
                                </Card>
                            )}

                            {activeTab === 'audit' && lead && (
                                <Card title="Audit history">
                                    <AuditHistoryTab entityType="lead" entityId={lead.id} />
                                </Card>
                            )}

                            {activeTab === 'stakeholders' && lead && (
                                <Card title="Stakeholders">
                                    <StakeholdersTab
                                        leadId={lead.id}
                                        deals={associatedDeals}
                                        onSwitchToNotes={() => setActiveTab('notes')}
                                        onSwitchToCalls={() => setActiveTab('calls')}
                                        onSwitchToMeetings={() => setActiveTab('meetings')}
                                    />
                                </Card>
                            )}

                            {activeTab === 'emails' && lead && (
                                <Card title="Emails">
                                    <EmailsTab leadId={lead.id} />
                                </Card>
                            )}

                            {activeTab === 'meetings' && lead && (
                                <Card title="Meetings">
                                    <MeetingsTab key={meetingsRefreshKey} leadId={lead.id} />
                                </Card>
                            )}
                        </div>
                    </div>
                )}
            </DetailPageTemplate>
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

            {/* Delete Lead Confirmation */}
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete Lead"
                message="Are you sure you want to delete this lead? This will remove all associated deals, notes, activities, tasks, and documents."
                confirmLabel="Delete Lead"
                intent="danger"
                onConfirm={handleDeleteLead}
                onCancel={() => setShowDeleteConfirm(false)}
            />
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
        </>
    );
};

export default LeadDetailPage;

