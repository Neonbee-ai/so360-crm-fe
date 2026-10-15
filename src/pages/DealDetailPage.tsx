import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventBus } from '@so360/event-bus';
import NeuraAiSummaryCard from './components/NeuraAiSummaryCard';
import { useActivity, useShell } from '@so360/shell-context';
import {
    Calendar, DollarSign, Clock, MessageSquare,
    AtSign, Phone, FileText, Plus, CheckCircle2, User as UserIcon, Users,
    Tag, Edit2, Trash2, X, Download, UploadCloud, FileIcon, File,
    ExternalLink, Briefcase, Receipt, Info, LayoutDashboard, Loader2, Zap, FileSignature, Check
} from 'lucide-react';
import { StageTransitionModal } from '../components/kanban/StageTransitionModal';
import SignRequestModal from '../components/sign/SignRequestModal';
import DealProductsTab from './components/DealProductsTab';
import CallsTab from './components/CallsTab';
import DealPaymentPlanPanel from './components/DealPaymentPlanPanel';
import DealCommissionPanel from './components/DealCommissionPanel';
import { useCrmFeatureFlag, RE_FLAGS } from '../hooks/useCrmFeatureFlag';
import { CrossLinkChip, toast, useConfirm, DetailPageTemplate, Button, IconButton, Card, EmptyState, Badge, Select, DatePicker, NumberInput, Textarea, Grid, GridItem, FileUpload } from '@so360/design-system';
import { crmService, dealsApi, tasksApi, activitiesApi, TimelineEvent } from '../services/crmService';
import { useCRMFormatters } from '../utils/formatters';
import { Deal, Activity, Task, Note, CustomFieldDefinition, User, Attachment, ActivityType } from '../types/crm';
import { ClickToCallButton } from '../components/common/ClickToCallButton';
import TaskModal from './components/TaskModal';
import { Modal } from '../components/common/Modal';
import { FEATURES } from '../config/features';
import { DealLifecycleStepper } from '../components/DealLifecycleStepper';
import { goBackFrom } from '../components/common/DetailBackLink';
import { ProjectSelect } from '../components/common/ProjectSelect';
import ActivityHistoryDrawer from './components/ActivityHistoryDrawer';

type TabType = 'activity' | 'notes' | 'tasks' | 'documents' | 'custom' | 'products' | 'calls' | 'payment-plan' | 'commission';

// Notify other MFEs (e.g. the Documents module) that a CRM deal document changed
// so they can refresh linked-document views. Uses the shared event bus with a
// window CustomEvent fallback for environments where the bus is unavailable.
export function publishDealDocumentsChanged(dealId: string) {
    const payload = { source: 'crm', entity_type: 'crm:deal', entity_id: dealId };
    try {
        eventBus.publish('documents:changed', payload);
    } catch {
        window.dispatchEvent(new CustomEvent('documents:changed', { detail: payload }));
    }
}

// Open a deal document: DMS-backed docs resolve a (signed) URL on demand; legacy
// docs fall back to their stored `url`.
export async function openDealDocument(doc: Attachment) {
    let url = doc.url;
    if (doc.dmsDocumentId) {
        url = await crmService.getDocumentDownloadUrl(doc.id);
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

const DEAL_TAB_TITLES: Record<string, string> = {
    activity: 'Activity timeline',
    notes: 'Deal notes',
    tasks: 'Deal tasks',
    documents: 'Deal documents',
    products: 'Deal products',
    custom: 'Additional details',
    calls: 'Call log',
    'payment-plan': 'Payment schedule',
    commission: 'Commission details',
};

const DealDetailPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const formatters = useCRMFormatters();
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    // RE Phase C: payment plan + commission tabs, each behind its own flag.
    const paymentPlansOn = useCrmFeatureFlag(RE_FLAGS.PAYMENT_PLANS);
    const commissionsOn = useCrmFeatureFlag(RE_FLAGS.COMMISSIONS);

    const [deal, setDeal] = useState<Deal | null>(null);
    const [associatedLead, setAssociatedLead] = useState<any>(null);
    // G8 Client 360: full cross-module timeline (calls, WhatsApp, email, meetings, tasks, notes, documents, bookings)
    const [showActivityDrawer, setShowActivityDrawer] = useState(false);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [dealStages, setDealStages] = useState<{ id: string, name: string, type?: string }[]>([]);

    const [activeTab, setActiveTab] = useState<TabType>('activity');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // UI Modals / States
    const [isEditingSummary, setIsEditingSummary] = useState(false);
    const [isChangingStage, setIsChangingStage] = useState(false);
    const stageDropdownRef = useRef<HTMLDivElement>(null);
    const [stageTransition, setStageTransition] = useState<{
        isOpen: boolean;
        newStage: string;
        newStageId: string | null;
    }>({ isOpen: false, newStage: '', newStageId: null });
    const [isChangingOwner, setIsChangingOwner] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [newNoteContent, setNewNoteContent] = useState('');

    // Edit state for summary fields (separate from deal to avoid direct mutation)
    const [editedValue, setEditedValue] = useState<number | null>(null);
    const [editedCloseDate, setEditedCloseDate] = useState<string | null>(null);
    const [editedOwnerId, setEditedOwnerId] = useState<string | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [signOpen, setSignOpen] = useState(false);
    const shellCtx = useShell() as any;
    const { isModuleEnabled, hasPermission, permissionsLoaded } = shellCtx;
    const canUseNeuraAi = (shellCtx?.effectiveFlagsLoaded !== false) && (shellCtx?.isFeatureEnabled?.('submodule:crm:neura_ai_copilot') ?? false);
    // Destructive action — gate on deals.delete, fail closed. Backend already enforces it.
    const canDeleteDeal = permissionsLoaded === true && (hasPermission?.('deals.delete') ?? false);
    // Stage changes mutate the deal — gate on deals.update, fail closed. Backend already enforces it.
    const canEditDeal = permissionsLoaded === true && (hasPermission?.('deals.update') ?? false);
    const isSignEnabled = isModuleEnabled('sign');
    const [projectDetails, setProjectDetails] = useState<{
        id: string;
        title: string;
        status: string;
        budget_total: number;
        completion_percentage: number;
    } | null>(null);

    const [invoiceStatus, setInvoiceStatus] = useState<{
        has_invoice: boolean;
        invoice_id?: string;
        invoice_number?: string;
        status?: string;
        total?: number;
        amount_paid?: number;
        balance_due?: number;
        issue_date?: string;
        due_date?: string;
        currency?: string;
    } | null>(null);

    const [fulfillmentOrder, setFulfillmentOrder] = useState<any | null>(null);

    const fetchProjectDetails = async (projectId: string) => {
        // crmService.getProjectById() already logs its own failures and
        // resolves null rather than throwing.
        const project = await crmService.getProjectById(projectId);
        setProjectDetails(project);
    };

    const fetchData = useCallback(async () => {
        try {
            if (deal) setIsRefreshing(true);
            else setIsLoading(true);

            const [dealData, settingsData, usersData, tasksData, activitiesData, notesData, docsData] = await Promise.all([
                crmService.getDealById(id),
                crmService.getSettings(),
                crmService.getUsers(),
                crmService.getTasksByDealId(id),
                crmService.getActivitiesByDealId(id),
                crmService.getNotesByDealId(id),
                crmService.getDocumentsByDealId(id)
            ]);

            if (dealData) {
                // Set deal with nested data merged in
                setDeal({
                    ...dealData,
                    activities: activitiesData,
                    notes: notesData,
                    documents: docsData
                });
                setActivities(activitiesData);
                setTasks(tasksData);

                // Fetch lead context if exists
                if (dealData.lead_id) {
                    const leadData = await crmService.getLeadById(dealData.lead_id);
                    setAssociatedLead(leadData);
                }

                // Fetch project details if linked
                if (dealData.project_id) {
                    await fetchProjectDetails(dealData.project_id);
                }

                // Fetch invoice status if deal has an invoice linked
                if (dealData.invoice_id) {
                    try {
                        const invStatus = await crmService.getInvoiceStatus(id);
                        setInvoiceStatus(invStatus);
                    } catch (err) {
                        console.warn('Failed to fetch invoice status:', err);
                        // Fallback: show basic info from the deal object itself
                        setInvoiceStatus({
                            has_invoice: true,
                            invoice_id: dealData.invoice_id,
                            invoice_number: dealData.invoice_number || undefined,
                            status: 'unknown',
                        });
                    }
                } else {
                    setInvoiceStatus(null);
                }
            }

            setCustomFieldDefs(settingsData?.deal_custom_fields || []);
            setDealStages(settingsData?.deal_stages || []);
            setAllUsers(usersData);
        } catch (error) {
            console.error('Failed to fetch deal workspace', error);
            toast.error('Failed to load deal details');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [id]);

    const getAggregatedTimeline = (): TimelineEvent[] => {
        if (!deal) return [];
        const events: TimelineEvent[] = [];

        // 1. Manual Activities
        activities.forEach(a => {
            const isSystem = ['STATUS_CHANGE', 'STAGE_CHANGE', 'OWNER_CHANGE', 'PROFILE_UPDATE'].includes(a.type);
            events.push({
                id: a.id,
                type: isSystem ? (a.type as any) : 'Activity',
                subType: isSystem ? undefined : a.type,
                title: isSystem ? a.type.replace('_', ' ') : `${a.type} Logged`,
                description: a.notes,
                date: a.created_at || a.date,
                author: a.author
            });
        });

        // 2. Notes
        (deal.notes || []).forEach(n => {
            events.push({
                id: n.id,
                type: 'NOTE',
                title: 'Note Captured',
                description: n.content,
                date: n.created_at,
                author: n.author
            });
        });

        // 3. Documents
        (deal.documents || []).forEach(d => {
            events.push({
                id: d.id,
                type: 'DOCUMENT',
                title: d.type === 'contract' ? 'Contract Uploaded' : 'Document Uploaded',
                description: `${d.name} (${(d.size / (1024 * 1024)).toFixed(2)} MB)`,
                date: d.created_at || d.uploaded_at,
                author: d.uploaded_by
            });
        });

        // 4. Tasks
        tasks.forEach(t => {
            events.push({
                id: t.id,
                type: 'TASK',
                subType: t.type,
                title: `Task: ${t.title}`,
                description: `Status: ${t.status} | Type: ${t.type}`,
                date: t.created_at || t.due_date,
                author: t.assigned_to
            });
        });

        // Sort by date descending
        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    useEffect(() => {
        crmService.getFulfillmentOrderByDeal(id)
            .then(order => setFulfillmentOrder(order))
            .catch(() => {});
    }, [id]);

    // Close the stage popover on an outside click or Escape — mirrors StageStatusSelect's
    // interaction pattern. Only wired up while the popover is actually open.
    useEffect(() => {
        if (!isChangingStage) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
                setIsChangingStage(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsChangingStage(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isChangingStage]);

    // Selecting a stage from the popover doesn't commit immediately — it opens the same
    // transition confirmation used by the Pipeline board, keeping both entry points on
    // one API path (crmService.updateDealStage -> target_state) and one UX.
    const handleSelectStage = (stageId: string) => {
        setIsChangingStage(false);
        if (!deal) return;
        if (stageId === (deal.stage_id || deal.stage)) return;
        const stage = dealStages.find(s => s.id === stageId);
        setStageTransition({ isOpen: true, newStage: stage?.name || stageId, newStageId: stageId });
    };

    const confirmStageTransition = async (reason: string) => {
        if (!deal || !stageTransition.newStageId) return;
        const { newStage, newStageId } = stageTransition;
        try {
            await crmService.updateDealStage(deal.id, newStageId, reason);
            setDeal(prev => prev ? { ...prev, stage: newStage as Deal['stage'], stage_id: newStageId, current_flow_state: newStageId } : null);
            toast.success('Deal stage updated');
            recordActivity({ eventType: 'deal.stage_changed', eventCategory: 'crm', description: `Deal "${deal.name}" moved to ${newStage}`, resourceType: 'deal', resourceId: deal.id }).catch(() => {});
            fetchData();
        } catch (error) {
            toast.error('Failed to update stage');
        }
    };

    const handleUpdateDeal = async (updates: Partial<Deal>) => {
        if (!deal) return;
        try {
            await dealsApi.update(deal.id, updates);
            setDeal(prev => prev ? { ...prev, ...updates } : null);
            toast.success('Deal updated successfully');

            // Auto-log activity
            await crmService.logActivity({
                lead_id: deal.lead_id,
                deal_id: deal.id,
                type: 'NOTE',
                notes: `Deal updated: ${Object.keys(updates).join(', ')}`,
                date: new Date().toISOString()
            });
            recordActivity({ eventType: 'deal.updated', eventCategory: 'crm', description: `Updated deal "${deal.name}"`, resourceType: 'deal', resourceId: deal.id }).catch(() => {});
            fetchData();
        } catch (error) {
            toast.error('Failed to update deal');
        }
    };

    const handleTaskToggle = async (task: Task) => {
        const newStatus = task.status === 'DONE' ? 'OPEN' : 'DONE';
        try {
            await crmService.updateTask(task.id, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t));

            await crmService.logActivity({
                lead_id: deal?.lead_id,
                deal_id: deal?.id,
                type: 'TASK',
                notes: `Task "${task.title}" marked as ${newStatus}`,
                date: new Date().toISOString()
            });
            toast.success(`Task ${newStatus}`);
        } catch (error) {
            toast.error('Failed to update task');
        }
    };

    // Both document flows hand Accounting the SAME deal context — the deal id
    // (so the existing estimate/invoice form can load this deal's associated
    // products as line items) plus the deal's customer. Nothing is duplicated
    // here: the products are read from CRM by the form itself, so what the user
    // sees is always the deal's current product list.
    const handleCreateEstimate = () => {
        if (!deal) return;
        const params = new URLSearchParams({ create: 'true' });
        if (id) params.set('deal_id', id);
        if (deal.name) params.set('opportunity_ref', deal.name);
        if (deal.partner_id) params.set('customer_id', deal.partner_id);
        if (deal.company_name) params.set('customer_name', deal.company_name);
        navigate(`/accounting/estimations?${params.toString()}`);
    };

    const handleCreateInvoice = () => {
        if (!deal) return;
        const params = new URLSearchParams({ create: 'true' });
        if (id) params.set('deal_id', id);
        if (deal.name) params.set('deal_name', deal.name);
        if (deal.partner_id) params.set('customer_id', deal.partner_id);
        if (deal.company_name) params.set('customer_name', deal.company_name);
        if (deal.value != null) params.set('amount', String(deal.value));
        navigate(`/accounting/invoices?${params.toString()}`);
    };

    // The picker loads (and searches) projects itself, page by page.
    const handleOpenProjectModal = () => {
        setIsProjectModalOpen(true);
    };

    const handleCreateProject = () => {
        if (!deal) return;
        const params = new URLSearchParams({ create: 'true' });
        if (id) params.set('deal_id', id);
        if (deal.name) params.set('deal_name', deal.name);
        if (deal.value != null) params.set('budget', String(deal.value));
        if (deal.company_name) params.set('client_name', deal.company_name);
        window.location.href = `/projects/list?${params.toString()}`;
    };

    const handleLinkExistingProject = async () => {
        if (!selectedProjectId) {
            toast.error('Please select a project to link');
            return;
        }
        try {
            await crmService.linkProject(id, selectedProjectId);
            toast.success('Project linked successfully');
            await crmService.logActivity({
                lead_id: deal?.lead_id,
                deal_id: id,
                type: 'NOTE',
                notes: `System: Linked existing project (ID: ${selectedProjectId}) to this deal`,
                date: new Date().toISOString()
            });
            setIsProjectModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to link project');
        }
    };

    const handleUnlinkProject = async () => {
        if (!deal || !await confirm({ title: 'Unlink project?', message: 'Are you sure you want to unlink this project?', intent: 'default', confirmLabel: 'Unlink' })) return;

        try {
            await crmService.unlinkProject(id);
            toast.success('Project unlinked successfully');

            // Log activity
            await crmService.logActivity({
                lead_id: deal?.lead_id,
                deal_id: id,
                type: 'NOTE',
                notes: 'System: Unlinked project from deal',
                date: new Date().toISOString()
            });

            // Refresh deal data
            setProjectDetails(null);
            setIsProjectModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Failed to unlink project:', error);
            toast.error('Failed to unlink project. Please try again.');
        }
    };

    // Handle saving deal profile edits
    const handleSaveProfile = async () => {
        if (!deal) return;
        setIsSavingProfile(true);
        try {
            const updates: Partial<Deal> = {};
            if (editedValue !== null && editedValue !== deal.value) {
                updates.value = editedValue;
            }
            if (editedCloseDate !== null && editedCloseDate !== deal.expected_close_date) {
                updates.expected_close_date = editedCloseDate;
            }
            if (editedOwnerId !== null && editedOwnerId !== deal.owner.id) {
                updates.owner_id = editedOwnerId;
            }

            if (Object.keys(updates).length > 0) {
                await handleUpdateDeal(updates);
            }
            setIsEditingSummary(false);
            resetEditState();
        } catch (error) {
            toast.error('Failed to save profile changes');
        } finally {
            setIsSavingProfile(false);
        }
    };

    // Cancel editing and reset fields
    const handleCancelEdit = () => {
        setIsEditingSummary(false);
        resetEditState();
    };

    // Reset edit state to current deal values
    const resetEditState = () => {
        setEditedValue(null);
        setEditedCloseDate(null);
        setEditedOwnerId(null);
    };

    // Initialize edit state when entering edit mode
    const handleStartEditing = () => {
        if (deal) {
            setEditedValue(deal.value);
            setEditedCloseDate(deal.expected_close_date || '');
            setEditedOwnerId(deal.owner.id);
        }
        setIsEditingSummary(true);
    };

    const handleDeleteDeal = async () => {
        setIsDeleting(true);
        const dealName = deal?.name || id;
        try {
            await crmService.deleteDeal(id);
            toast.success('Deal deleted successfully');
            recordActivity({ eventType: 'deal.deleted', eventCategory: 'crm', description: `Deleted deal "${dealName}"`, resourceType: 'deal', resourceId: id }).catch(() => {});
            navigate('/crm/pipeline');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete deal');
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div data-testid="deal-detail-skeleton">
                <div className="animate-pulse space-y-8">
                    {/* Header region: reserves the deal-name/stage row + button group row */}
                    <div data-testid="deal-detail-skeleton-header">
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-4 bg-surface-raised rounded w-24" />
                        </div>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-2">
                                <div className="h-8 bg-surface-raised rounded w-64" />
                                <div className="h-4 bg-surface-raised rounded w-40" />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="size-10 bg-surface-raised rounded-nb-lg" />
                                <div className="h-10 w-36 bg-surface-raised rounded-nb-lg" />
                                <div className="h-10 w-36 bg-surface-raised rounded-nb-lg" />
                            </div>
                        </div>
                    </div>

                    {/* Lifecycle stepper region */}
                    <div data-testid="deal-detail-skeleton-lifecycle" className="bg-surface border border-line rounded-nb-lg p-6 h-28" />

                    {/* Two-column grid region */}
                    <Grid data-testid="deal-detail-skeleton-grid" gap="md">
                        <GridItem span={{ lg: 8 }}><div className="space-y-nb-3">
                            <div className="bg-surface border border-line rounded-nb-lg h-40" />
                            <div data-testid="deal-detail-skeleton-tabs" className="bg-surface border border-line rounded-nb-lg h-96" />
                        </div></GridItem>
                        <GridItem span={{ lg: 4 }}><div className="space-y-nb-3">
                            <div className="bg-surface border border-line rounded-nb-lg h-64" />
                        </div></GridItem>
                    </Grid>
                </div>
            </div>
        );
    }

    if (!deal) {
        return (
            <div className="py-12 text-center text-fg-muted">
                <p>Deal not found.</p>
                <Button variant="secondary" onClick={() => navigate('/crm/pipeline')}>Back to Pipeline</Button>
            </div>
        );
    }

    const dealTabs = [
        { id: 'activity', label: 'Activity' },
        { id: 'notes', label: 'Notes' },
        { id: 'tasks', label: `Tasks (${tasks.length})` },
        { id: 'documents', label: `Docs (${deal.documents?.length || 0})` },
        { id: 'products', label: 'Products' },
        { id: 'custom', label: 'Additional Info' },
        { id: 'calls', label: 'Calls' },
        ...(paymentPlansOn ? [{ id: 'payment-plan', label: 'Payment plan' }] : []),
        ...(commissionsOn ? [{ id: 'commission', label: 'Commission' }] : []),
    ];

    return (
        <DetailPageTemplate
            title={deal.name}
            onBack={() => goBackFrom(navigate, '/crm/pipeline')}
            backLabel="Back"
            status={(
                            <div className="relative" ref={stageDropdownRef}>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    role="combobox"
                                    aria-expanded={isChangingStage}
                                    aria-haspopup="listbox"
                                    disabled={!canEditDeal}
                                    onClick={() => { if (canEditDeal) setIsChangingStage(o => !o); }}
                                    title={canEditDeal ? 'Change stage' : undefined}
                                    className="group gap-1.5"
                                    data-testid="deal-stage-trigger"
                                >
                                    {deal.stage}
                                    {canEditDeal && <Edit2 size={12} className="text-info opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </Button>

                                {isChangingStage && canEditDeal && (
                                    <div
                                        role="listbox"
                                        data-testid="deal-stage-list"
                                        className="absolute z-menu top-full left-0 mt-1 min-w-40 bg-surface border border-line rounded-nb shadow-xl overflow-hidden"
                                    >
                                        {dealStages.map(s => {
                                            const isCurrent = s.id === (deal.stage_id || deal.stage);
                                            return (
                                                <Button
                                                    variant={isCurrent ? 'primary' : 'secondary'}
                                                    size="sm"
                                                    key={s.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isCurrent}
                                                    onClick={() => handleSelectStage(s.id)}
                                                    className="w-full justify-between text-left"
                                                    data-testid={`deal-stage-option-${s.id}`}
                                                >
                                                    {s.name}
                                                    {isCurrent && <Check size={12} />}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
            )}
            meta={(
                <>
                        <p className="text-fg-subtle flex items-center gap-2 mt-1">
                            <span className="font-semibold text-fg">{deal.company_name}</span>
                            {deal.expected_close_date && (
                                <>
                                    <span className="w-1 h-1 bg-line rounded-full" />
                                    <span className="text-xs">Closing: {formatters.formatDate(deal.expected_close_date)}</span>
                                </>
                            )}
                        </p>
                    {isRefreshing && (
                        <div className="flex items-center gap-1 text-xs text-info animate-pulse">
                            <Loader2 size={10} className="animate-spin" /> Syncing...
                        </div>
                    )}
                </>
            )}
            primaryAction={FEATURES.DEAL_PROJECT_CREATION ? (
                <Button onClick={handleOpenProjectModal}><Briefcase size={14} />
                    {deal.project_id ? 'Manage Project' : 'Create Project'}
                </Button>
            ) : undefined}
            secondaryActions={[
                ...(FEATURES.DEAL_ESTIMATE_REQUEST ? [<Button key="estimate" variant="secondary" onClick={handleCreateEstimate}><FileText size={14} />Create Estimate</Button>] : []),
                ...(FEATURES.DEAL_INVOICE_REQUEST ? [<Button key="invoice" variant="secondary" onClick={handleCreateInvoice}><Receipt size={14} />Create Invoice</Button>] : []),
            ]}
            overflowActions={[
                ...(isSignEnabled ? [{ label: 'Request Signature', onSelect: () => setSignOpen(true) }] : []),
                ...(canDeleteDeal ? [{ label: 'Delete', danger: true, onSelect: () => setShowDeleteConfirm(true) }] : []),
            ]}
            tabs={dealTabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as TabType)}
            sidePanel={(
                <>
                    <Card
                        title="Owner"
                        actions={isEditingSummary ? (
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="secondary" onClick={handleCancelEdit} title="Cancel"><X size={14} /></Button>
                                <Button type="button" variant="primary" onClick={handleSaveProfile} disabled={isSavingProfile} title="Save Changes">
                                    {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                </Button>
                            </div>
                        ) : (
                            <Button type="button" variant="secondary" onClick={handleStartEditing} title="Edit Profile"><Edit2 size={14} /></Button>
                        )}
                    >
                        <div className="flex flex-col gap-nb-3">
<div className="space-y-1">
                                    <span className="text-xs text-fg-muted">Deal Owner</span>
                                    {isEditingSummary ? (
                                        <Select
                                            name="deal-owner"
                                            aria-label="Owner"
                                            value={editedOwnerId ?? deal.owner.id}
                                            onChange={(e) => setEditedOwnerId(e.target.value)}
                                            options={allUsers.map(u => ({ value: u.id, label: u.full_name }))}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center text-xs font-medium overflow-hidden border border-line">
                                                {deal.owner.avatar_url ? <img src={deal.owner.avatar_url} alt={deal.owner.full_name} /> : deal.owner.full_name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-fg">{deal.owner.full_name}</span>
                                        </div>
                                    )}
                                </div>
                                {deal.owner_person_id && (
                                    <div className="space-y-1">
                                        <span className="text-xs text-fg-muted">Sales Rep</span>
                                        {deal.owner_person ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center text-xs font-medium overflow-hidden border border-line">
                                                    {deal.owner_person.avatar_url
                                                        ? <img src={deal.owner_person.avatar_url} alt={deal.owner_person.full_name} />
                                                        : (deal.owner_person.full_name || '?').charAt(0)}
                                                </div>
                                                <span className="text-sm font-bold text-fg">{deal.owner_person.full_name}</span>
                                                {deal.owner_person.job_title && (
                                                    <span className="text-xs font-bold text-fg-muted">{deal.owner_person.job_title}</span>
                                                )}
                                                {deal.owner_person.department_name && (
                                                    <span className="text-xs font-bold text-fg-muted">· {deal.owner_person.department_name}</span>
                                                )}
                                                {deal.owner_person.status !== 'active' && (
                                                    <span className="text-xs text-warning border border-warning/40 rounded-nb px-1.5 py-0.5">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm font-bold text-fg-muted">
                                                Sales rep unavailable from People Connect
                                            </p>
                                        )}
                                    </div>
                                )}
                        </div>
                    </Card>

                    <Card title="Dates">
                        <div className="flex flex-col gap-nb-3">
<div className="space-y-1">
                                    <span className="text-xs text-fg-muted">Expected Close</span>
                                    {isEditingSummary ? (
                                        <DatePicker
                                            name="deal-close-date"
                                            value={editedCloseDate ?? deal.expected_close_date ?? ''}
                                            onChange={(v) => setEditedCloseDate(v as string)}
                                        />
                                    ) : (
                                        <p className="text-sm font-bold text-fg flex items-center gap-1.5">
                                            <Calendar size={16} />{deal.expected_close_date || '—'}
                                        </p>
                                    )}
                                </div>
<div className="space-y-1">
                                    <span className="text-xs text-fg-muted">Last Activity</span>
                                    <p className="text-sm font-bold text-fg-subtle flex items-center gap-1.5">
                                        <Clock size={16} className="text-fg-muted" />
                                        {deal.last_activity_at ? formatters.formatDate(deal.last_activity_at) : 'None'}
                                    </p>
                                </div>
                            <div className="space-y-1">
                                <span className="text-xs text-fg-muted">Created</span>
                                <p className="text-sm text-fg-subtle">{formatters.formatDate(deal.created_at)}</p>
                            </div>
                        </div>
                    </Card>

                    <Card title="Value">
<div className="space-y-1">
                                    <span className="text-xs text-fg-muted">Financial Value</span>
                                    {isEditingSummary ? (
                                        <NumberInput
                                            name="deal-value"
                                            value={editedValue ?? deal.value}
                                            onChange={(v) => setEditedValue(v ?? 0)}
                                        />
                                    ) : (
                                        <p className="text-xl font-semibold text-success flex items-center gap-1.5">
                                            {formatters.formatCurrency(deal.value)}
                                        </p>
                                    )}
                                </div>
                    </Card>

                    {/* 4. Neura summary */}
                    {canUseNeuraAi && (
                        <NeuraAiSummaryCard
                            leadId={deal.id}
                            leadLabel={deal.name}
                            isInboxEnabled={false}
                            entity="deals"
                        />
                    )}

                    {/* Cross-module linked records */}
                    {(deal.invoice_id || deal.project_id || fulfillmentOrder?.id) && (
                        <Card title="Linked Records">
                            <div className="flex flex-wrap gap-2">
                                {deal.invoice_id && (
                                    <CrossLinkChip type="accounting.invoice" id={deal.invoice_id} label={deal.invoice_number || undefined} />
                                )}
                                {deal.project_id && <CrossLinkChip type="projects.project" id={deal.project_id} />}
                                {fulfillmentOrder?.id && <CrossLinkChip type="fulfillment.order" id={fulfillmentOrder.id} />}
                            </div>
                        </Card>
                    )}

                    {/* Contact Details Card */}
                    {associatedLead && (
                        <Card title="Primary Contact">
                            <div className="space-y-6">
                                <Link to={`/crm/leads/${associatedLead.id}`} className="group/link block">
                                    <h4 className="text-lg font-medium text-fg group-hover/link:text-info transition-colors">{associatedLead.contact_name}</h4>
                                    <p className="text-xs font-bold text-fg-subtle flex items-center gap-1">
                                        <Building2 size={12} /> {associatedLead.company_name}
                                    </p>
                                </Link>
                                <div className="space-y-3 pt-4 border-t border-line">
                                    <a href={`mailto:${associatedLead.contact_email}`} className="flex items-center gap-3 text-xs font-bold text-fg-subtle hover:text-fg transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center"><Mail size={14} /></div>
                                        {associatedLead.contact_email}
                                    </a>
                                    {associatedLead.phone && (
                                        <div className="flex items-center gap-2">
                                            <a href={`tel:${associatedLead.phone}`} className="flex items-center gap-3 flex-1 text-xs font-bold text-fg-subtle hover:text-fg transition-colors">
                                                <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center"><Phone size={14} /></div>
                                                {associatedLead.phone}
                                            </a>
                                            <ClickToCallButton
                                                number={associatedLead.phone}
                                                entityType="deal"
                                                entityId={deal.id}
                                                name={associatedLead.contact_name || deal.name}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Linked Invoice Card */}
                    {invoiceStatus?.has_invoice && (
                        <Card title="Linked Invoice">
                            <div className="space-y-4">
                                {invoiceStatus.invoice_number && (
                                    <div>
                                        <span className="text-xs font-medium text-fg-muted  block mb-1">Invoice Number</span>
                                        <p className="text-sm font-bold text-fg">{invoiceStatus.invoice_number}</p>
                                    </div>
                                )}

                                <div className="flex justify-between items-center py-2 border-t border-line">
                                    <span className="text-xs font-medium text-fg-muted ">Status</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium  ${
                                        invoiceStatus.status === 'paid' ? 'bg-success/10 text-success border border-success/20' :
                                        invoiceStatus.status === 'sent' || invoiceStatus.status === 'pending' ? 'bg-info/10 text-info border border-info/20' :
                                        invoiceStatus.status === 'overdue' ? 'bg-danger/10 text-danger border border-danger/20' :
                                        invoiceStatus.status === 'draft' ? 'bg-fg-muted/10 text-fg-subtle border border-line' :
                                        invoiceStatus.status === 'partially_paid' ? 'bg-warning/10 text-warning border border-warning/20' :
                                        'bg-fg-muted/10 text-fg-subtle border border-line'
                                    }`}>
                                        {invoiceStatus.status === 'partially_paid' ? 'Partial' : invoiceStatus.status || 'Unknown'}
                                    </span>
                                </div>

                                {invoiceStatus.total != null && (
                                    <div className="flex justify-between items-center py-2 border-t border-line">
                                        <span className="text-xs font-medium text-fg-muted ">Total</span>
                                        <span className="text-sm font-bold text-success">
                                            {formatters.formatCurrency(Number(invoiceStatus.total))}
                                        </span>
                                    </div>
                                )}

                                {invoiceStatus.amount_paid != null && invoiceStatus.amount_paid > 0 && (
                                    <div className="flex justify-between items-center py-2 border-t border-line">
                                        <span className="text-xs font-medium text-fg-muted ">Paid</span>
                                        <span className="text-sm font-bold text-success">
                                            {formatters.formatCurrency(Number(invoiceStatus.amount_paid))}
                                        </span>
                                    </div>
                                )}

                                {invoiceStatus.balance_due != null && invoiceStatus.balance_due > 0 && (
                                    <div className="flex justify-between items-center py-2 border-t border-line">
                                        <span className="text-xs font-medium text-fg-muted ">Balance Due</span>
                                        <span className="text-sm font-bold text-warning">
                                            {formatters.formatCurrency(Number(invoiceStatus.balance_due))}
                                        </span>
                                    </div>
                                )}

                                {invoiceStatus.due_date && (
                                    <div className="flex justify-between items-center py-2 border-t border-line">
                                        <span className="text-xs font-medium text-fg-muted ">Due Date</span>
                                        <span className="text-xs font-bold text-fg-subtle">
                                            {formatters.formatDate(invoiceStatus.due_date)}
                                        </span>
                                    </div>
                                )}

                                <a
                                    href="/accounting/invoices"
                                    className="mt-2 flex items-center justify-center gap-2 w-full h-nb-control-md bg-surface-raised hover:bg-line text-fg rounded-nb-lg text-xs font-medium  transition-all border border-line"
                                >
                                    <ExternalLink size={12} /> View in Accounting
                                </a>
                            </div>
                        </Card>
                    )}

                    {/* Fulfillment Tracking Card */}
                    {fulfillmentOrder && (() => {
                        const fo = fulfillmentOrder;
                        const lastShipment = fo.fulfillment_shipments?.[0];
                        const lastEvent = lastShipment?.fulfillment_shipment_events?.[0];
                        const statusColor =
                            fo.status === 'delivered' ? 'text-success bg-success/10 border-success/20' :
                            fo.status === 'out_for_delivery' ? 'text-success bg-success/10 border-success/20' :
                            fo.status === 'in_transit' ? 'text-info bg-info/10 border-info/20' :
                            fo.status === 'delivery_failed' ? 'text-danger bg-danger/10 border-danger/20' :
                            'text-fg-subtle bg-fg-muted/10 border-line';
                        return (
                            <Card title="Fulfillment Tracking">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-fg-muted ">Status</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium  border ${statusColor}`}>
                                            {fo.status?.replace(/_/g, ' ') || 'pending'}
                                        </span>
                                    </div>
                                    {lastShipment?.tracking_number && (
                                        <div className="flex items-center justify-between py-2 border-t border-line">
                                            <span className="text-xs font-medium text-fg-muted ">Tracking #</span>
                                            <span className="text-xs font-mono text-fg-subtle">{lastShipment.tracking_number}</span>
                                        </div>
                                    )}
                                    {lastEvent && (
                                        <div className="py-2 border-t border-line">
                                            <span className="text-xs font-medium text-fg-muted  block mb-1">Last Event</span>
                                            <p className="text-xs text-fg-subtle leading-relaxed">{lastEvent.description}</p>
                                            {lastEvent.location && (
                                                <p className="text-xs text-fg-muted mt-0.5">{lastEvent.location}</p>
                                            )}
                                            <p className="text-xs text-fg-muted mt-1">{formatters.formatDateTime(lastEvent.occurred_at || lastEvent.created_at)}</p>
                                        </div>
                                    )}
                                    {fo.estimated_delivery_at && (
                                        <div className="flex items-center justify-between py-2 border-t border-line">
                                            <span className="text-xs font-medium text-fg-muted ">ETA</span>
                                            <span className="text-xs font-bold text-fg-subtle">{formatters.formatDate(fo.estimated_delivery_at)}</span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })()}
                </>
            )}
        >
            {confirmDialog}

            <div className="flex flex-col gap-nb-3">
                <Card title="Deal lifecycle">
                    <DealLifecycleStepper
                        stages={dealStages}
                        currentStageId={deal.stage_id}
                        currentState={deal.current_flow_state || deal.stage}
                    />
                </Card>

                <Card
                    title={DEAL_TAB_TITLES[activeTab] || 'Details'}
                    actions={activeTab === 'activity' ? (
                        <Button type="button" variant="secondary" onClick={() => setShowActivityDrawer(true)}>
                            View All History
                        </Button>
                    ) : undefined}
                >
                        <div>

                            {activeTab === 'activity' && (
                                <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-surface-raised">
                                    {getAggregatedTimeline().length === 0 ? (
                                        <div className="text-center py-12 ml-6">
                                            <MessageSquare size={48} className="mx-auto mb-4 text-fg opacity-30" />
                                            <p className="text-fg-subtle font-semibold mb-2">No activity history yet</p>
                                            <p className="text-xs text-fg-muted max-w-sm mx-auto leading-relaxed">
                                                Activities like calls, meetings, and emails will appear here as you interact with this deal.
                                            </p>
                                        </div>
                                    ) : (
                                        getAggregatedTimeline().map((ev) => (
                                            <div key={ev.id} className="relative pl-10">
                                                <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-surface-raised border-2 border-line flex items-center justify-center">
                                                    {(ev.type === 'Activity' && ev.subType === 'CALL') && <Phone size={14} className="text-info" />}
                                                    {(ev.type === 'Activity' && ev.subType === 'MEETING') && <Users size={14} className="text-primary" />}
                                                    {(ev.type === 'Activity' && ev.subType === 'EMAIL') && <AtSign size={14} className="text-success" />}
                                                    {ev.type === 'NOTE' && <FileText size={14} className="text-warning" />}
                                                    {ev.type === 'TASK' && <CheckCircle2 size={14} className="text-primary" />}
                                                    {ev.type === 'DOCUMENT' && <UploadCloud size={14} className="text-info" />}
                                                    {['STATUS_CHANGE', 'STAGE_CHANGE', 'OWNER_CHANGE', 'PROFILE_UPDATE'].includes(ev.type) && <Zap size={14} className="text-warning" />}
                                                </div>
                                                <div className="bg-surface-sunken border border-line p-4 rounded-nb-lg group hover:border-line transition-all">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-semibold text-fg text-xs">
                                                            {ev.title}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {ev.type === 'Activity' && (
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                                    <IconButton label="Edit activity" variant="ghost" icon={<Edit2 size={12} />} onClick={async () => {
                                                                            const newNotes = prompt('Edit activity notes:', ev.description);
                                                                            if (newNotes !== null) {
                                                                                await activitiesApi.update(ev.id, { notes: newNotes });
                                                                                fetchData();
                                                                            }
                                                                        }} />
                                                                    <IconButton label="Delete activity" variant="danger" icon={<Trash2 size={12} />} onClick={async () => {
                                                                            if (await confirm({ title: 'Delete?', message: 'Delete this activity?', intent: 'danger', confirmLabel: 'Delete' })) {
                                                                                await activitiesApi.delete(ev.id);
                                                                                fetchData();
                                                                            }
                                                                        }} />
                                                                </div>
                                                            )}
                                                            <span className="text-xs bg-surface-raised text-fg-muted px-2 py-0.5 rounded font-semibold">
                                                                {formatters.formatDateTime(ev.date)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-fg-subtle text-sm leading-relaxed">{ev.description}</p>
                                                    {ev.author && (
                                                        <div className="mt-4 flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-full bg-surface-raised flex items-center justify-center text-xs font-semibold overflow-hidden border border-line">
                                                                {ev.author.avatar_url ? <img src={ev.author.avatar_url} /> : ev.author.full_name?.charAt(0)}
                                                            </div>
                                                            <span className="text-xs font-bold text-fg-muted">{ev.author.full_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* NOTES TAB */}
                            {activeTab === 'notes' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        {deal.notes.map(note => (
                                            <div key={note.id} className="text-sm border-l-2 border-warning/30 pl-4 py-1 group relative">
                                                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                    <IconButton label="Edit note" variant="ghost" icon={<Edit2 size={12} />} onClick={async () => {
                                                            const content = prompt('Edit note:', note.content);
                                                            if (content) {
                                                                await crmService.updateNote(note.id, content);
                                                                fetchData();
                                                            }
                                                        }} />
                                                    <IconButton label="Delete note" variant="danger" icon={<Trash2 size={12} />} onClick={async () => {
                                                            if (await confirm({ title: 'Delete?', message: 'Delete note?', intent: 'danger', confirmLabel: 'Delete' })) {
                                                                await crmService.deleteNote(note.id);
                                                                fetchData();
                                                            }
                                                        }} />
                                                </div>
                                                <p className="text-fg-subtle leading-relaxed mb-2 pr-12">{note.content}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-fg-muted">{note.author.full_name}</span>
                                                    <span className="text-xs text-fg-muted font-bold">{formatters.formatDate(note.created_at)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-bg border border-line rounded-nb-lg p-4">
                                        <Textarea
                                            name="deal-new-note"
                                            placeholder="Capture commercial context..."
                                            value={newNoteContent}
                                            onChange={(e) => setNewNoteContent(e.target.value)}
                                        />
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={async () => {
                                                    await crmService.createNote({ deal_id: id, content: newNoteContent });
                                                    setNewNoteContent('');
                                                    fetchData();
                                                }}>Save Note</Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TASKS TAB */}
                            {activeTab === 'tasks' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-xs font-semibold text-fg-muted">Planned actions</h4>
                                        <Button variant="secondary" size="sm" onClick={() => setIsCreatingTask(true)}>
                                            <Plus size={12} /> Add Task
                                        </Button>
                                    </div>
                                    <div className="grid gap-3">
                                        {tasks.length === 0 ? (
                                            <EmptyState title="Zero pending actions" />
                                        ) : (
                                            tasks.map(task => (
                                                <div key={task.id} className={`flex items-start gap-4 p-4 bg-bg border rounded-nb-lg group relative transition-all ${task.status === 'DONE' ? 'border-success/10 opacity-60' : 'border-line hover:border-info/50'}`}>
                                                    <IconButton
                                                        label={task.status === 'DONE' ? 'Mark task not done' : 'Mark task done'}
                                                        icon={task.status === 'DONE' ? <CheckCircle2 size={12} /> : null}
                                                        size="sm"
                                                        onClick={() => handleTaskToggle(task)}
                                                     />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between">
                                                            <h4 className={`text-sm font-bold text-fg truncate ${task.status === 'DONE' ? 'line-through text-fg-muted' : ''}`}>
                                                                {task.title}
                                                            </h4>
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-3 text-xs font-bold text-fg-subtle pt-2 border-t border-line">
                                                            <span className="flex items-center gap-1 text-fg-subtle">
                                                                <Clock size={11} /> Due {formatters.formatDate(task.due_date)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                                                        <IconButton label="Edit task" variant="ghost" icon={<Edit2 size={14} />} onClick={() => setEditingTask(task)} />
                                                        <IconButton label="Delete task" variant="danger" icon={<Trash2 size={14} />} onClick={async () => {
                                                                if (await confirm({ title: 'Delete?', message: 'Delete task?', intent: 'danger', confirmLabel: 'Delete' })) {
                                                                    await tasksApi.delete(task.id);
                                                                    fetchData();
                                                                }
                                                            }} />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* DOCUMENTS TAB */}
                            {activeTab === 'documents' && (
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-xs font-semibold text-fg-muted mb-nb-3">Attachments & Contracts</p>
                                        <FileUpload
                                            name="deal-document"
                                            aria-label="Upload file"
                                            prompt={isUploading ? 'Uploading...' : 'Upload File'}
                                            disabled={isUploading}
                                            value={[]}
                                            onChange={async (files) => {
                                                const file = files[0];
                                                if (file) {
                                                    setIsUploading(true);
                                                    try {
                                                        await crmService.uploadDocument({ dealId: id }, file);
                                                        publishDealDocumentsChanged(id);
                                                        fetchData();
                                                    } finally { setIsUploading(false); }
                                                }
                                            }}
                                        />
                                    </div>
                                    <Grid gap="md">
                                        {(deal.documents || []).map(doc => (
                                            <GridItem key={doc.id} span={{ md: 4, lg: 6 }}>                                            <div className="flex items-center justify-between p-4 bg-bg border border-line rounded-nb-lg group hover:border-line">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-surface-raised p-2 rounded-lg text-info"><FileIcon size={20} /></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-fg truncate max-w-36">{doc.name}</p>
                                                        <p className="text-xs font-semibold text-fg-muted">{(doc.size / 1024).toFixed(1)} KB</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {doc.dmsDocumentId ? (
                                                        <IconButton label="Download" variant="ghost" icon={<Download size={16} />} onClick={() => { void openDealDocument(doc); }} />
                                                    ) : (
                                                        <a href={doc.url} download title="Download" className="p-2 text-fg-muted hover:text-fg transition-colors"><Download size={16} /></a>
                                                    )}
                                                    <IconButton label="Delete file" variant="danger" icon={<Trash2 size={16} />} onClick={async () => {
                                                            if (await confirm({ title: 'Delete?', message: 'Delete file?', intent: 'danger', confirmLabel: 'Delete' })) {
                                                                await crmService.deleteDocument(id, doc.id);
                                                                publishDealDocumentsChanged(id);
                                                                fetchData();
                                                            }
                                                        }} />
                                                </div>
                                            </div></GridItem>
                                        ))}
                                    </Grid>
                                </div>
                            )}

                            {/* CUSTOM FIELDS TAB */}
                            {activeTab === 'custom' && (
                                <Grid gap="md">
                                    {customFieldDefs.length === 0 ? (
                                        <GridItem span="full"><p className="text-fg-muted italic text-sm">No additional fields configured in Deals settings.</p></GridItem>
                                    ) : (
                                        customFieldDefs.map(field => (
                                            <GridItem key={field.id} span={{ md: 4, lg: 6 }}><div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-semibold text-fg-muted">{field.label}</span>
                                                <p className="text-sm font-bold text-fg border-l-2 border-line pl-3 py-1">
                                                    {field.type === 'boolean'
                                                        ? (deal.custom_fields?.[field.id] ? 'Yes' : 'No')
                                                        : field.type === 'date' && deal.custom_fields?.[field.id]
                                                            ? formatters.formatDate(deal.custom_fields[field.id])
                                                            : deal.custom_fields?.[field.id] || '—'}
                                                </p>
                                            </div></GridItem>
                                        ))
                                    )}
                                </Grid>
                            )}

                            {activeTab === 'products' && (
                                <DealProductsTab
                                    dealId={deal.id}
                                    leadId={deal.lead_id}
                                />
                            )}

                            {activeTab === 'calls' && (
                                <CallsTab dealId={deal.id} />
                            )}

                            {activeTab === 'payment-plan' && paymentPlansOn && (
                                <DealPaymentPlanPanel dealId={deal.id} />
                            )}

                            {activeTab === 'commission' && commissionsOn && (
                                <DealCommissionPanel dealId={deal.id} />
                            )}
                        </div>
                </Card>
            </div>

            {/* Sign Request Modal */}
            {signOpen && (
                <SignRequestModal
                    onClose={() => setSignOpen(false)}
                    prefillName={associatedLead?.contact_name ?? ''}
                    prefillEmail={associatedLead?.contact_email ?? deal?.contact_email ?? ''}
                    sourceModel="crm.deal"
                    sourceId={deal?.id ?? id ?? ''}
                />
            )}

            {/* PROJECT LINKING MODAL */}
            {isProjectModalOpen && (
                <Modal
                    isOpen
                    onClose={() => setIsProjectModalOpen(false)}
                    title="Project Management"
                    size="lg"
                    data-testid="deal-project-modal"
                    footer={(
                        <>
                            <Button type="button" variant="secondary" onClick={() => setIsProjectModalOpen(false)}>Cancel</Button>
                            <Button type="button" variant="primary" onClick={handleLinkExistingProject} disabled={!selectedProjectId}>
                                Confirm Link
                            </Button>
                        </>
                    )}
                >
                    <div className="flex flex-col gap-nb-4">
                        {/* CREATE OPTION */}
                        <div className="bg-surface border border-line rounded-nb-lg p-nb-4 hover:border-info/30 transition-colors group cursor-pointer" onClick={handleCreateProject}>
                            <div className="flex items-start justify-between gap-nb-3">
                                <div className="min-w-0">
                                    <h4 className="text-fg font-bold text-sm mb-1 group-hover:text-info transition-colors">Create New Project</h4>
                                    <p className="text-fg-muted text-xs leading-relaxed">
                                        Open the Projects module with deal info pre-filled to create and configure a new project.
                                    </p>
                                </div>
                                <Button type="button" variant="primary" size="sm">
                                    Open <ExternalLink size={10} />
                                </Button>
                            </div>
                        </div>

                        <div className="relative flex items-center gap-nb-3">
                            <div className="flex-1 h-px bg-surface-raised"></div>
                            <span className="text-xs font-semibold text-fg">OR</span>
                            <div className="flex-1 h-px bg-surface-raised"></div>
                        </div>

                        {/* LINK OPTION */}
                        <div className="flex flex-col gap-nb-3">
                            <div>
                                <h4 className="text-fg font-bold text-sm mb-1">Link Existing Project</h4>
                                <p className="text-fg-muted text-xs">Reference a project already existing in the system.</p>
                            </div>
                            <ProjectSelect
                                value={selectedProjectId}
                                onChange={setSelectedProjectId}
                                noneLabel="Select current project..."
                            />
                        </div>

                        {projectDetails && (
                            <div className="p-nb-3 bg-surface-sunken border border-line rounded-nb-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-fg-muted">
                                        Linked Project
                                    </span>
                                    <Badge size="sm" tone={projectDetails.status === 'COMPLETED' ? 'success' : 'info'}>
                                        {projectDetails.status}
                                    </Badge>
                                </div>
                                <h4 className="text-sm font-bold text-fg mb-2">{projectDetails.title}</h4>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-fg-subtle">
                                        Budget: {formatters.formatCurrency(projectDetails.budget_total || 0)}
                                    </span>
                                    {projectDetails.completion_percentage > 0 && (
                                        <span className="text-fg-subtle">
                                            {projectDetails.completion_percentage}% Complete
                                        </span>
                                    )}
                                </div>
                                <div className="mt-nb-3 flex items-center gap-nb-2">
                                    <a
                                        href={`/projects/${projectDetails.id}`}
                                        className="flex-1 text-center text-sm font-bold text-primary hover:underline"
                                    >
                                        View Project Details →
                                    </a>
                                    <Button type="button" variant="danger" size="sm" onClick={handleUnlinkProject}>
                                        Unlink
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!projectDetails && deal.project_id && (
                            <div className="p-nb-3 bg-surface-sunken border border-line rounded-nb-lg text-center">
                                <span className="text-fg-muted text-xs">
                                    Project ID: {deal.project_id}
                                </span>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Modals */}
            {(isCreatingTask || editingTask) && (
                <TaskModal
                    task={editingTask}
                    dealId={id}
                    dealProjectId={deal?.project_id}
                    onClose={() => { setIsCreatingTask(false); setEditingTask(null); }}
                    onSuccess={() => { fetchData(); toast.success('Timeline updated'); }}
                />
            )}

            {/* Stage Transition Confirmation Modal — same component & confirmation flow as the Pipeline board */}
            <StageTransitionModal
                isOpen={stageTransition.isOpen}
                onClose={() => setStageTransition(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmStageTransition}
                deal={deal}
                newStage={stageTransition.newStage}
            />

            {/* Delete Deal Confirmation Modal */}
            {showDeleteConfirm && (
                <Modal
                    isOpen
                    onClose={() => setShowDeleteConfirm(false)}
                    title="Delete Deal"
                    size="sm"
                    dismissible={!isDeleting}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
                            <Button variant="danger" onClick={handleDeleteDeal} disabled={isDeleting}>
                                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                                Delete Deal
                            </Button>
                        </>
                    }
                >
                    <p className="text-fg-subtle">
                        Are you sure you want to delete this deal? This will remove all associated notes, activities, tasks, and documents. This action cannot be undone.
                    </p>
                </Modal>
            )}

            {showActivityDrawer && (
                <ActivityHistoryDrawer
                    isOpen={showActivityDrawer}
                    onClose={() => setShowActivityDrawer(false)}
                    entityType="deal"
                    entityId={deal.id}
                />
            )}

        </DetailPageTemplate>
    );
};

// Internal Mini Icon for Sidebar
const Building2 = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="10" width="20" height="12" rx="2" /><path d="M7 22V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" /><path d="M10 8h4" /><path d="M10 12h4" /><path d="M10 16h4" /></svg>;
const Mail = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>;

export default DealDetailPage;
