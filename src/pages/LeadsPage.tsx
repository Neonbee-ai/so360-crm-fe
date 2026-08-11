import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Tag,
  UserCheck,
  Trash2,
  Archive,
  Download,
  Flag,
  X,
  ChevronDown,
  BookmarkPlus,
  Bookmark,
  SlidersHorizontal,
  Pencil,
  Copy,
  Star,
  Share2,
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { Lead, User } from '../types/crm';
import { CreateLeadModal } from '../components/leads/CreateLeadModal';
import { LeadsDataGrid, GridContext } from '../components/leads/LeadsDataGrid';
import { LeadDetailPanel } from '../components/leads/LeadDetailPanel';
import LeadFilterBuilder from '../components/leads/LeadFilterBuilder';
import { countActiveRules, type FilterGroup } from '../components/leads/leadFilterModel';
import { leadsToCsv, downloadCsv } from '../components/leads/leadsCsv';
import { SummaryMetricChips } from '../components/common/SummaryMetricChips';
import { useNotify, useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { QuotaGate } from '@so360/design-system';

// ─── Saved views (lightweight local version) ──────────────────────────────────

interface FilterState {
  search: string;
  status: string;
  owner: string;
  creator: string;
  dateRange: string;
  customDateStart: string;
  customDateEnd: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'All',
  owner: 'All',
  creator: 'All',
  dateRange: 'All',
  customDateStart: '',
  customDateEnd: '',
};

const SAVED_VIEWS_KEY = 'crm_leads_saved_views_v1';

interface SavedFilterView {
  id: string;
  name: string;
  filters: FilterState;
  is_default?: boolean;
  is_shared?: boolean;
}

function loadSavedViews(): SavedFilterView[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) ?? '[]') as SavedFilterView[];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedFilterView[]) {
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    /* ignore */
  }
}

// Map a backend grid view (opaque config JSON) to the page's SavedFilterView.
function mapBeView(v: {
  id: string;
  name: string;
  config?: { filters?: FilterState };
  is_default?: boolean;
  is_shared?: boolean;
}): SavedFilterView {
  return {
    id: v.id,
    name: v.name,
    filters: (v?.config?.filters ?? {}) as FilterState,
    is_default: v.is_default,
    is_shared: v.is_shared,
  };
}

// ─── Date range helper ────────────────────────────────────────────────────────

function isDateInRange(
  dateString: string,
  filter: string,
  customStart: string,
  customEnd: string,
): boolean {
  if (filter === 'All') return true;
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfLastWeek);
  endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  switch (filter) {
    case 'Today': return date >= today;
    case 'Yesterday': return date >= yesterday && date < today;
    case 'This Week': return date >= startOfWeek;
    case 'Last Week': return date >= startOfLastWeek && date <= endOfLastWeek;
    case 'This Month': return date >= startOfMonth;
    case 'Last Month': return date >= startOfLastMonth && date <= endOfLastMonth;
    case 'Custom':
      if (customStart && customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        return date >= new Date(customStart) && date <= end;
      }
      return true;
    default: return true;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const LeadsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const formatters = useCRMFormatters();
  const { emitNotification } = useNotify();
  const { recordActivity } = useActivity();
  const shell = useShellBridge();
  const canCreateLead = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:create') ?? true);
  const canUpdateLead = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:update') ?? true);
  const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();
  const quotaChecks = useMemo(() => [{ module_code: 'crm', quota_key: 'max_contacts' }], []);
  const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
  const quotaData = getQuota('max_contacts');

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadStages, setLeadStages] = useState<{ id: string; name: string }[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customFields, setCustomFields] = useState<{ id: string; label: string }[]>([]);
  const [activeSegmentName, setActiveSegmentName] = useState<string | null>(null);

  // UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  // Only one filter/views popover may be open at a time.
  const [openDropdown, setOpenDropdown] = useState<'moreFilters' | 'views' | null>(null);
  const moreFiltersRef = useRef<HTMLDivElement>(null);
  const viewsDropdownRef = useRef<HTMLDivElement>(null);
  // Advanced (server-side) filter tree. null = feature inactive, the normal
  // fetchInitialData list governs. Non-null triggers a server-side refetch via
  // getLeadsPaged so nested AND/OR filters run against the whole dataset, not
  // just the currently-loaded page.
  const [advancedFilter, setAdvancedFilter] = useState<FilterGroup | null>(null);

  // Filters — persisted so opening a lead and coming back keeps the list the
  // user built rather than resetting to every-lead, page 1.
  const [filters, setFilters] = usePersistedState<FilterState>('leads.filters', DEFAULT_FILTERS);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedFilterView[]>(loadSavedViews);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveViewInput, setShowSaveViewInput] = useState(false);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = usePersistedState('leads.page', 1);
  const [pageSize, setPageSize] = usePersistedState('leads.pageSize', 50);

  const listAnchorRef = useRef<HTMLDivElement>(null);
  useListScrollRestore('leads', listAnchorRef, !isLoading);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, val: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setCurrentPage(1);
    setActiveViewId(null);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
    setActiveViewId(null);
  }, []);

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'search') return v !== '';
    if (['customDateStart', 'customDateEnd'].includes(k)) return false;
    return v !== 'All';
  });

  // Fetch
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(location.search);
      const segmentId = params.get('segmentId');
      const segmentName = params.get('segmentName');
      const q = params.get('q') ?? undefined;

      const [leadsData, settingsData, usersData] = await Promise.all([
        segmentId
          ? crmService.getCustomerSegmentLeads(segmentId).then((res: any) => res?.leads ?? [])
          : crmService.getLeads({ ...(q ? { q } : {}) }),
        crmService.getSettings(),
        crmService.getUsers(),
      ]);

      setLeads(leadsData);
      setLeadStages(settingsData?.lead_stages ?? []);
      setLeadSources(
        (settingsData?.lead_sources ?? [])
          .filter((s: any) => s && !s.archived)
          .map((s: any) => s.name)
          .filter(Boolean),
      );
      setCustomFields(
        (settingsData?.lead_custom_fields ?? []).map((cf: any) => ({
          id: cf.id,
          label: cf.label,
        })),
      );
      setUsers(usersData);
      setActiveSegmentName(segmentId ? (segmentName ?? 'Segment') : null);
      if (q) setFilter('search', q);
    } catch (err: any) {
      console.error('Failed to fetch initial data', err);
      setError(err.message ?? 'Failed to initialize page');
    } finally {
      setIsLoading(false);
    }
  }, [location.search, setFilter]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Advanced server-side filter: whenever a non-null tree is applied, refetch the
  // leads list through the paged endpoint with the serialized filter. Clearing
  // the tree (Apply with nothing complete) re-runs the normal initial fetch.
  useEffect(() => {
    if (!advancedFilter) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await crmService.getLeadsPaged({
          filter: JSON.stringify(advancedFilter),
          take: 1000,
        });
        if (!cancelled) setLeads(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to apply advanced filters');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [advancedFilter]);

  const handleApplyAdvancedFilter = useCallback((tree: FilterGroup | null) => {
    setShowAdvancedFilters(false);
    setCurrentPage(1);
    if (tree) {
      setAdvancedFilter(tree);
    } else if (advancedFilter) {
      // Cleared an active advanced filter — fall back to the standard list.
      setAdvancedFilter(null);
      fetchInitialData();
    }
  }, [advancedFilter, fetchInitialData]);

  // Filtering
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const fullName = lead.first_name
        ? [lead.first_name, lead.last_name].filter(Boolean).join(' ')
        : (lead.contact_name ?? '');
      const q = filters.search.toLowerCase();
      if (q) {
        const hit =
          (lead.company_name ?? '').toLowerCase().includes(q) ||
          fullName.toLowerCase().includes(q) ||
          (lead.contact_email ?? '').toLowerCase().includes(q) ||
          (lead.phone ?? '').includes(q) ||
          (lead.source ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filters.status !== 'All' && lead.status !== filters.status) return false;
      if (filters.owner !== 'All' && lead.owner?.id !== filters.owner) return false;
      if (filters.creator !== 'All' && lead.creator?.id !== filters.creator) return false;
      if (!isDateInRange(lead.created_at, filters.dateRange, filters.customDateStart, filters.customDateEnd)) return false;
      return true;
    });
  }, [leads, filters]);

  // KPI chip counts — derived purely for display, computed off the full unpaginated
  // list (not filteredLeads) so the chips always reflect totals regardless of the
  // active filter/search state.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    return counts;
  }, [leads]);

  const kpiStages = leadStages;

  const toggleStatusChip = useCallback((stageName: string) => {
    setFilter('status', filters.status === stageName ? 'All' : stageName);
  }, [filters.status, setFilter]);

  const sandboxLeads = useMemo(
    () => (isSandboxMode ? filteredLeads.slice(0, sandboxEntryLimit) : filteredLeads),
    [filteredLeads, isSandboxMode, sandboxEntryLimit],
  );

  const totalPages = Math.ceil(sandboxLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sandboxLeads.slice(start, start + pageSize);
  }, [sandboxLeads, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [filters]);

  // Close the More Filters / Views popover on outside click or Escape.
  useEffect(() => {
    if (!openDropdown) return;
    const activeRef = openDropdown === 'moreFilters' ? moreFiltersRef : viewsDropdownRef;
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeRef.current && !activeRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openDropdown]);

  // Handlers
  const handleOwnerChange = useCallback(async (lead: Lead, newOwnerId: string) => {
    const newOwner = users.find((u) => u.id === newOwnerId);
    if (!newOwner) return;
    try {
      await crmService.updateLead(lead.id, { owner: newOwner });
      await crmService.logActivity({ lead_id: lead.id, type: 'OWNER_CHANGE', notes: `Assigned owner changed to ${newOwner.full_name}`, date: new Date().toISOString() });
      emitNotification({ event: 'CRM_LEAD_ASSIGNED', userIds: [newOwnerId], variables: { leadName: lead.company_name, actorName: 'You' }, relatedResource: { type: 'lead', id: lead.id } }).catch(() => {});
      recordActivity({ eventType: 'lead.assigned', eventCategory: 'crm', description: `Assigned lead "${lead.company_name}" to ${newOwner.full_name}`, resourceType: 'lead', resourceId: lead.id }).catch(() => {});
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, owner: newOwner } : l));
    } catch {
      /* ignore */
    }
  }, [users, emitNotification, recordActivity]);

  const handleStatusChange = useCallback(async (lead: Lead, newStageId: string) => {
    const stage = leadStages.find((s) => s.id === newStageId);
    const displayName = stage?.name ?? newStageId;
    try {
      await crmService.updateLead(lead.id, { status: displayName as any });
      await crmService.logActivity({ lead_id: lead.id, type: 'STATUS_CHANGE', notes: `Lead status changed to ${displayName}`, date: new Date().toISOString() });
      const isConverted = newStageId === 'converted' || newStageId === 'won';
      recordActivity({ eventType: isConverted ? 'lead.converted' : 'lead.status_changed', eventCategory: 'crm', description: `Lead "${lead.company_name}" status changed to ${displayName}`, resourceType: 'lead', resourceId: lead.id }).catch(() => {});
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: displayName as any, backend_status: newStageId } as any : l));
    } catch {
      /* ignore */
    }
  }, [leadStages, recordActivity]);

  const handleDeleteLead = useCallback(async (leadId: string) => {
    setIsDeleting(true);
    try {
      await crmService.deleteLead(leadId);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setShowDeleteConfirm(null);
      setDetailLead((prev) => (prev?.id === leadId ? null : prev));
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete lead');
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    // Single bulk request (server processes per-id and reports partial success)
    // instead of N client round-trips. Only remove the rows the server confirms.
    try {
      const res = await crmService.bulkDeleteLeads(ids);
      const removed = res?.deleted?.length ? res.deleted : ids;
      setLeads((prev) => prev.filter((l) => !removed.includes(l.id)));
    } catch {
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    }
  }, []);

  const handleBulkOwnerChange = useCallback(async (ids: string[], ownerId: string) => {
    const owner = users.find((u) => u.id === ownerId);
    if (!owner) return;
    // Send owner_id (the column the backend actually persists) via one bulk call.
    try {
      const res = await crmService.bulkUpdateLeads(ids, { owner_id: ownerId });
      const changed = res?.updated?.length ? res.updated : ids;
      setLeads((prev) => prev.map((l) => changed.includes(l.id) ? { ...l, owner } : l));
    } catch {
      setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, owner } : l));
    }
  }, [users]);

  const handleBulkStatusChange = useCallback(async (ids: string[], statusName: string) => {
    try {
      const res = await crmService.bulkUpdateLeads(ids, { status: statusName });
      const changed = res?.updated?.length ? res.updated : ids;
      setLeads((prev) => prev.map((l) => changed.includes(l.id) ? { ...l, status: statusName as any } : l));
    } catch {
      setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, status: statusName as any } : l));
    }
  }, []);

  const handleBulkSourceChange = useCallback(async (ids: string[], source: string) => {
    try {
      const res = await crmService.bulkUpdateLeads(ids, { source });
      const changed = res?.updated?.length ? res.updated : ids;
      setLeads((prev) => prev.map((l) => changed.includes(l.id) ? { ...l, source } : l));
    } catch {
      setLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, source } : l));
    }
  }, []);

  const handleBulkExport = useCallback((ids: string[]) => {
    const chosen = leads.filter((l) => ids.includes(l.id));
    const rows = chosen.length ? chosen : leads;
    const csv = leadsToCsv(rows);
    downloadCsv(`leads-export-${rows.length}.csv`, csv);
  }, [leads]);

  // Saved views — persisted to the backend (cross-device) with an optimistic
  // localStorage fallback so it still works offline / on an older backend.
  const handleSaveView = useCallback(async () => {
    const name = saveViewName.trim();
    if (!name) return;
    const localView: SavedFilterView = { id: `v_${Date.now()}`, name, filters };
    const withLocal = [...savedViews, localView];
    setSavedViews(withLocal);
    persistSavedViews(withLocal);
    setActiveViewId(localView.id);
    setSaveViewName('');
    setShowSaveViewInput(false);
    try {
      const created = await crmService.gridViews?.create?.({ name, config: { filters } });
      if (created?.id) {
        setSavedViews((prev) => {
          const reconciled = prev.map((v) => (v.id === localView.id ? mapBeView(created) : v));
          persistSavedViews(reconciled);
          return reconciled;
        });
        setActiveViewId(created.id);
      }
    } catch {
      /* offline — the optimistic local view stands */
    }
  }, [saveViewName, filters, savedViews]);

  const handleDeleteView = useCallback((id: string) => {
    const updated = savedViews.filter((v) => v.id !== id);
    setSavedViews(updated);
    persistSavedViews(updated);
    if (activeViewId === id) setActiveViewId(null);
    crmService.gridViews?.remove?.(id)?.catch?.(() => { /* offline / local-only view */ });
  }, [savedViews, activeViewId]);

  const handleApplyView = useCallback((view: SavedFilterView) => {
    setFilters(view.filters);
    setActiveViewId(view.id);
    setOpenDropdown(null);
  }, []);

  // Rename — optimistic local update, persisted to the backend (no-op offline).
  const handleRenameView = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedViews((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, name: trimmed } : v));
      persistSavedViews(updated);
      return updated;
    });
    crmService.gridViews?.update?.(id, { name: trimmed })?.catch?.(() => { /* offline */ });
  }, []);

  // Duplicate — the backend clones the view (config + name "(copy)"); reconcile
  // the returned server view into the list. Falls back to a local clone offline.
  const handleDuplicateView = useCallback(async (id: string) => {
    const source = savedViews.find((v) => v.id === id);
    if (!source) return;
    try {
      const created = await crmService.gridViews?.duplicate?.(id);
      if (created?.id) {
        setSavedViews((prev) => {
          const next = [...prev, mapBeView(created)];
          persistSavedViews(next);
          return next;
        });
        return;
      }
    } catch {
      /* offline — fall through to a local clone */
    }
    setSavedViews((prev) => {
      const next = [...prev, { ...source, id: `v_${Date.now()}`, name: `${source.name} (copy)`, is_default: false }];
      persistSavedViews(next);
      return next;
    });
  }, [savedViews]);

  // Set default — exactly one default; clear the flag on the others locally.
  const handleSetDefaultView = useCallback((id: string) => {
    setSavedViews((prev) => {
      const updated = prev.map((v) => ({ ...v, is_default: v.id === id }));
      persistSavedViews(updated);
      return updated;
    });
    crmService.gridViews?.setDefault?.(id)?.catch?.(() => { /* offline */ });
  }, []);

  // Share — flip visibility for the whole org (team-shared view).
  const handleToggleShareView = useCallback((id: string) => {
    const current = savedViews.find((v) => v.id === id);
    if (!current) return;
    const nextShared = !current.is_shared;
    setSavedViews((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, is_shared: nextShared } : v));
      persistSavedViews(updated);
      return updated;
    });
    crmService.gridViews?.update?.(id, { is_shared: nextShared })?.catch?.(() => { /* offline */ });
  }, [savedViews]);

  // Hydrate saved views from the backend on mount (cross-device). Only overwrite
  // the localStorage-backed list when the backend actually has views, so a user
  // with local-only views (before the feature shipped) never loses them.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(crmService.gridViews?.list?.('lead'))
      .then((views) => {
        if (cancelled || !Array.isArray(views) || views.length === 0) return;
        const mapped = views.map(mapBeView);
        setSavedViews(mapped);
        persistSavedViews(mapped);
        const def = (views as Array<{ id: string; is_default?: boolean }>).find((v) => v.is_default);
        if (def) setActiveViewId(def.id);
      })
      .catch(() => { /* offline — keep localStorage views */ });
    return () => { cancelled = true; };
  }, []);

  // Grid context
  // Inline cell edit — optimistic local update, persisted via updateLead, reverted
  // on failure. `field` is a Lead property key (updateLead maps it to the column).
  const handleInlineEdit = useCallback(async (lead: Lead, field: string, value: string) => {
    const previous = (lead as any)[field];
    if (previous === value) return;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? ({ ...l, [field]: value } as Lead) : l)));
    try {
      await crmService.updateLead(lead.id, { [field]: value } as any);
      recordActivity({
        eventType: 'lead.updated',
        eventCategory: 'crm',
        description: `Updated ${field.replace(/_/g, ' ')} on "${lead.company_name}"`,
        resourceType: 'lead',
        resourceId: lead.id,
      }).catch(() => {});
    } catch {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? ({ ...l, [field]: previous } as Lead) : l)));
    }
  }, [recordActivity]);

  const gridContext = useMemo<GridContext>(() => ({
    users,
    leadStages,
    canUpdate: canUpdateLead,
    onOwnerChange: handleOwnerChange,
    onStatusChange: handleStatusChange,
    onDelete: (lead) => setShowDeleteConfirm(lead.id),
    onOpen: (lead) => navigate(`${lead.id}`),
    formatDate: formatters.formatDate,
    onInlineEdit: handleInlineEdit,
  }), [users, leadStages, canUpdateLead, handleOwnerChange, handleStatusChange, navigate, formatters, handleInlineEdit]);

  const bulkActions = useMemo(() => [
    {
      label: 'Assign',
      icon: <UserCheck size={14} />,
      options: users.map((u) => ({ label: u.full_name || u.email, value: u.id })),
      onSelect: (ids: string[], ownerId: string) => handleBulkOwnerChange(ids, ownerId),
    },
    {
      label: 'Status',
      icon: <Flag size={14} />,
      options: leadStages.map((s) => ({ label: s.name, value: s.name })),
      onSelect: (ids: string[], statusName: string) => handleBulkStatusChange(ids, statusName),
    },
    {
      label: 'Source',
      icon: <Filter size={14} />,
      options: leadSources.map((s) => ({ label: s, value: s })),
      onSelect: (ids: string[], source: string) => handleBulkSourceChange(ids, source),
    },
    {
      label: 'Export',
      icon: <Download size={14} />,
      onClick: (ids: string[]) => handleBulkExport(ids),
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger' as const,
      onClick: (ids: string[]) => handleBulkDelete(ids),
    },
  ].filter((a: any) => !a.options || a.options.length > 0),
  [users, leadStages, leadSources, handleBulkOwnerChange, handleBulkStatusChange, handleBulkSourceChange, handleBulkExport, handleBulkDelete]);

  return (
    <div className="px-4 pt-3 pb-6 md:px-6" ref={listAnchorRef}>
      {/* Compact header */}
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-lg font-bold text-slate-50 tracking-tight truncate">Leads & Accounts</h1>
          <span className="text-sm text-slate-500 shrink-0">
            {leads.length} Lead{leads.length !== 1 ? 's' : ''}
          </span>
        </div>
        {canCreateLead && (
          <QuotaGate
            quotaKey="max_contacts"
            moduleCode="crm"
            used={leads.length}
            limit={quotaData?.limit ?? 0}
            isUnlimited={quotaData?.is_unlimited}
            disableOnExceeded
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 h-10 bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-blue-900/20 active:scale-95 shrink-0"
            >
              <Plus size={16} />
              New Lead
            </button>
          </QuotaGate>
        )}
      </header>

      {/* KPI chips */}
      <SummaryMetricChips
        className="mb-3"
        chips={[
          { key: 'total', label: 'Total', count: leads.length, active: filters.status === 'All', onClick: () => setFilter('status', 'All') },
          ...kpiStages.map((stage) => ({
            key: stage.id,
            label: stage.name,
            count: statusCounts[stage.name] ?? 0,
            active: filters.status === stage.name,
            onClick: () => toggleStatusChip(stage.name),
          })),
        ]}
      />

      {/* Sandbox notice */}
      {isSandboxMode && isLimited(filteredLeads.length) && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-sm">
          <span className="font-semibold">Sandbox:</span>
          <span>Showing {sandboxEntryLimit} of {filteredLeads.length} leads. Switch to Production to view all records.</span>
        </div>
      )}

      {/* Modal */}
      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchInitialData}
        existingLeads={leads.map((l) => l.company_name)}
      />

      {/* Toolbar — single consolidated row wherever width permits */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/50">
        {activeSegmentName && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0">
            <Tag size={12} />
            Segment: {activeSegmentName}
          </span>
        )}

        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
          <input
            type="text"
            placeholder="Search leads..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/50 text-slate-200 pl-10 pr-4 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          {filters.search && (
            <button
              onClick={() => setFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="bg-slate-950 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 shrink-0"
        >
          <option value="All">All Statuses</option>
          {leadStages.map((stage) => (
            <option key={stage.id} value={stage.name}>{stage.name}</option>
          ))}
        </select>

        <select
          value={filters.owner}
          onChange={(e) => setFilter('owner', e.target.value)}
          className="bg-slate-950 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 shrink-0"
        >
          <option value="All">All Owners</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.full_name}</option>
          ))}
        </select>

        <select
          value={filters.dateRange}
          onChange={(e) => setFilter('dateRange', e.target.value)}
          className="bg-slate-950 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 shrink-0"
        >
          <option value="All">All Time</option>
          <option value="Today">Today</option>
          <option value="Yesterday">Yesterday</option>
          <option value="This Week">This Week</option>
          <option value="Last Week">Last Week</option>
          <option value="This Month">This Month</option>
          <option value="Last Month">Last Month</option>
          <option value="Custom">Custom Range</option>
        </select>

        {filters.dateRange === 'Custom' && (
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/50 rounded-lg px-2 py-1 shrink-0">
            <input
              type="date"
              value={filters.customDateStart}
              onChange={(e) => setFilter('customDateStart', e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none"
            />
            <span className="text-slate-500">–</span>
            <input
              type="date"
              value={filters.customDateEnd}
              onChange={(e) => setFilter('customDateEnd', e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none"
            />
          </div>
        )}

        {/* More filters — Created By */}
        <div ref={moreFiltersRef} className="relative shrink-0">
          <button
            onClick={() => setOpenDropdown((v) => (v === 'moreFilters' ? null : 'moreFilters'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              filters.creator !== 'All'
                ? 'text-blue-300 bg-blue-500/10 border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-700/50'
            }`}
          >
            <Filter size={13} />
            More Filters
            {filters.creator !== 'All' && (
              <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5">1</span>
            )}
            <ChevronDown size={13} />
          </button>

          {openDropdown === 'moreFilters' && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl min-w-[220px] p-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Created By</label>
              <select
                value={filters.creator}
                onChange={(e) => setFilter('creator', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="All">All</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-rose-400 hover:text-rose-300 underline flex items-center gap-1 shrink-0"
          >
            <X size={12} />
            Clear filters
          </button>
        )}

        <div className="flex-1" />

        {/* Saved views */}
        <div ref={viewsDropdownRef} className="relative shrink-0">
            <button
              onClick={() => setOpenDropdown((v) => (v === 'views' ? null : 'views'))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/50 transition-colors"
            >
              <Bookmark size={14} />
              {activeViewId ? savedViews.find((v) => v.id === activeViewId)?.name ?? 'Views' : 'Views'}
              <ChevronDown size={14} />
            </button>

            {openDropdown === 'views' && (
              <div className="absolute left-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/60 rounded-xl shadow-xl min-w-[300px] py-1.5">
                {savedViews.length === 0 && (
                  <p className="px-4 py-2 text-xs text-slate-500">No saved views yet</p>
                )}
                {savedViews.map((view) => (
                  <div key={view.id} className="group" data-testid={`saved-view-${view.id}`}>
                    {renamingViewId === view.id ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input
                          autoFocus
                          type="text"
                          aria-label="Rename view"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { handleRenameView(view.id, renameValue); setRenamingViewId(null); }
                            if (e.key === 'Escape') setRenamingViewId(null);
                          }}
                          className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => { handleRenameView(view.id, renameValue); setRenamingViewId(null); }}
                          className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <button
                          onClick={() => handleApplyView(view)}
                          className={`flex-1 flex items-center gap-1.5 text-left px-4 py-2 text-sm transition-colors ${activeViewId === view.id ? 'text-blue-400' : 'text-slate-300 hover:bg-slate-800'}`}
                        >
                          {view.is_default && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                          <span className="truncate">{view.name}</span>
                          {view.is_shared && (
                            <span title="Shared with your team">
                              <Share2 size={10} className="text-slate-500 shrink-0" />
                            </span>
                          )}
                        </button>
                        <div className="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            aria-label="Rename view"
                            onClick={() => { setRenamingViewId(view.id); setRenameValue(view.name); }}
                            className="p-1 text-slate-500 hover:text-slate-200"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            aria-label="Duplicate view"
                            onClick={() => handleDuplicateView(view.id)}
                            className="p-1 text-slate-500 hover:text-slate-200"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            aria-label={view.is_default ? 'Default view' : 'Set as default'}
                            onClick={() => handleSetDefaultView(view.id)}
                            className={`p-1 ${view.is_default ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                          >
                            <Star size={12} className={view.is_default ? 'fill-amber-400' : ''} />
                          </button>
                          <button
                            aria-label={view.is_shared ? 'Unshare view' : 'Share view'}
                            onClick={() => handleToggleShareView(view.id)}
                            className={`p-1 ${view.is_shared ? 'text-blue-400' : 'text-slate-500 hover:text-blue-300'}`}
                          >
                            <Share2 size={12} />
                          </button>
                          <button
                            aria-label="Delete view"
                            onClick={() => handleDeleteView(view.id)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="border-t border-slate-700/50 mt-1 pt-1">
                  {showSaveViewInput ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="View name..."
                        value={saveViewName}
                        onChange={(e) => setSaveViewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); if (e.key === 'Escape') setShowSaveViewInput(false); }}
                        className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button onClick={handleSaveView} className="text-blue-400 hover:text-blue-300 text-xs font-semibold">Save</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveViewInput(true)}
                      className="flex items-center gap-1.5 w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <BookmarkPlus size={13} />
                      Save current view
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Advanced filter builder */}
          <div className="relative">
            <button
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                advancedFilter
                  ? 'text-blue-300 bg-blue-500/10 border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-700/50'
              }`}
            >
              <SlidersHorizontal size={14} />
              Advanced
              {advancedFilter && (
                <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5">
                  {countActiveRules(advancedFilter)}
                </span>
              )}
            </button>

            {showAdvancedFilters && (
              <div className="absolute right-0 top-full mt-1.5 z-50">
                <LeadFilterBuilder
                  value={advancedFilter}
                  onApply={handleApplyAdvancedFilter}
                  onClose={() => setShowAdvancedFilters(false)}
                />
              </div>
            )}
          </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Data grid */}
      <LeadsDataGrid
        leads={paginatedLeads}
        isLoading={isLoading}
        context={gridContext}
        onRowClick={(lead) => setDetailLead((prev) => (prev?.id === lead.id ? null : lead))}
        bulkActions={bulkActions}
        customFields={customFields}
      />

      {/* Pagination */}
      {sandboxLeads.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-800 border border-slate-600/50 rounded px-2 py-1 text-slate-200"
            >
              {[25, 50, 100, 250].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span>of {sandboxLeads.length} leads</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-slate-800 border border-slate-600/50 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-slate-800 border border-slate-600/50 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-slate-300 text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-slate-800 border border-slate-600/50 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-slate-800 border border-slate-600/50 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700/50 rounded-lg shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Delete Lead</h2>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete this lead? This will also remove all associated notes, activities, and documents. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLead(showDeleteConfirm)}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isDeleting && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      <LeadDetailPanel
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onNavigate={(lead) => navigate(`${lead.id}`)}
        onNavigateDeal={(deal) => navigate(`../deal/${deal.id}`)}
        onNavigateTask={(task) => navigate(`../tasks/${task.id}`)}
        onDelete={(lead) => setShowDeleteConfirm(lead.id)}
      />
    </div>
  );
};

export default LeadsPage;
