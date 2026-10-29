import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Filter,
  Plus,
  UserCheck,
  Trash2,
  Archive,
  Download,
  Flag,
  X,
  BookmarkPlus,
  Bookmark,
  Pencil,
  Copy,
  Star,
  Share2,
  UploadCloud,
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { ratingService, type RatingCategory } from '../services/salesConfigService';
import { Lead, User } from '../types/crm';
import { CreateLeadModal } from '../components/leads/CreateLeadModal';
import { ImportHub } from '../components/import/ImportHub';
import { useCrmFeatureFlag, RE_FLAGS } from '../hooks/useCrmFeatureFlag';
import { LeadsDataGrid, GridContext } from '../components/leads/LeadsDataGrid';
import { LeadDetailPanel } from '../components/leads/LeadDetailPanel';
import LeadFilterBuilder from '../components/leads/LeadFilterBuilder';
import { countActiveRules, type FilterGroup } from '../components/leads/leadFilterModel';
import { leadsToCsv, downloadCsv } from '../components/leads/leadsCsv';
import { useNotify, useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { describeApiError } from '../utils/apiErrorMessage';
import { publishLeadsChanged } from '../utils/leadEvents';
import ExportMenu, { useCanExport } from '../components/ExportMenu';
import { exportService } from '../services/exportService';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { QuotaGate, toast, ListPageTemplate, Button, SearchInput, EmptyState, Pagination, ConfirmDialog, TextField, SegmentedControl, Modal, IconButton } from '@so360/design-system';
import type { FilterValues, ListFilterConfig } from '@so360/design-system';

// ─── Saved views (lightweight local version) ──────────────────────────────────

interface FilterState {
  search: string;
  status: string;
  owner: string;
  creator: string;
  rating: string;
  dateRange: string;
  customDateStart: string;
  customDateEnd: string;
}

/** Sentinel owner-filter value for the Unassigned view (leads with no owner). */
const UNASSIGNED_OWNER = '__unassigned__';

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'All',
  owner: 'All',
  creator: 'All',
  rating: 'All',
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
  const canCreateLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:create') ?? true);
  const canUpdateLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.update') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:leads:update') ?? true);
  // Destructive action — gate on the delete permission, fail closed, independent
  // of canUpdateLead. Mirrors LeadDetailPage.tsx's canDeleteLead; the backend
  // already enforces leads.delete on both the single and bulk delete routes —
  // this only controls visibility of a control the user couldn't otherwise use.
  const canDeleteLead = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('leads.delete') ?? false);
  // Bulk import (A7) — flag-gated, and only for users who may create leads.
  const bulkImportEnabled = useCrmFeatureFlag(RE_FLAGS.BULK_IMPORT);
  const canImportLeads = canCreateLead && bulkImportEnabled;
  // §48 server-side CSV / Excel / PDF export — RBAC-scoped on the server.
  const canExportLeads = useCanExport('leads.export', RE_FLAGS.DATA_EXPORT);
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
  const ratingEnabled = useCrmFeatureFlag('submodule:crm:lead_rating');
  const [ratings, setRatings] = useState<RatingCategory[]>([]);
  useEffect(() => {
    if (!ratingEnabled) { setRatings([]); return; }
    ratingService.list().then((rows) => setRatings(rows.filter((r) => r.is_active !== false))).catch(() => setRatings([]));
  }, [ratingEnabled]);
  const [customFields, setCustomFields] = useState<{ id: string; label: string }[]>([]);
  const [gridControlsSlot, setGridControlsSlot] = useState<HTMLElement | null>(null);

  // UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  // Only one filter/views popover may be open at a time.
  const [openDropdown, setOpenDropdown] = useState<'views' | null>(null);
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
      const q = params.get('q') ?? undefined;

      // Only the leads list holds the page spinner. Settings (9 reads) and users load
      // alongside and fill stage/source/owner columns when they land, so the grid
      // shows as soon as the leads answer instead of after the slowest of ~12 calls.
      crmService.getSettings()
        .then((settingsData: any) => {
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
        })
        .catch((err: any) => console.warn('Lead settings unavailable', err));
      crmService.getUsers()
        .then((usersData: any) => setUsers(usersData))
        .catch((err: any) => console.warn('Lead owners unavailable', err));

      const leadsData = await crmService.getLeads({ ...(q ? { q } : {}) });
      setLeads(leadsData);
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
      if (filters.owner === UNASSIGNED_OWNER) { if (lead.owner?.id) return false; }
      else if (filters.owner !== 'All' && lead.owner?.id !== filters.owner) return false;
      if (filters.creator !== 'All' && lead.creator?.id !== filters.creator) return false;
      if (filters.rating !== 'All' && lead.rating_category_id !== filters.rating) return false;
      if (!isDateInRange(lead.created_at, filters.dateRange, filters.customDateStart, filters.customDateEnd)) return false;
      return true;
    });
  }, [leads, filters]);

  // Status counts shown on the Status filter options — computed off the full unpaginated
  // list so they reflect totals regardless of the active filter/search state.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    return counts;
  }, [leads]);

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
      // Tell every other lead-derived surface (dashboard KPIs, pipeline
      // widgets) to re-read, so the counts drop without a manual refresh.
      publishLeadsChanged('deleted', [leadId]);
      // Soft delete means Undo is a genuine restore, history and all.
      toast.success('Lead deleted', {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            crmService.restoreLead(leadId)
              .then((restored) => {
                setLeads((prev) => (prev.some((l) => l.id === leadId) ? prev : [restored, ...prev]));
                publishLeadsChanged('restored', [leadId]);
                toast.success('Lead restored');
              })
              .catch((e: any) => toast.error(describeApiError(e, 'We couldn’t restore this lead.')));
          },
        },
      });
    } catch (err: any) {
      setError(describeApiError(err, 'We couldn’t delete this lead. Please try again.'));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    // Single bulk request (server processes per-id and reports partial success).
    //
    // ONLY the ids the server confirms leave the grid. Removing a row the
    // server refused is what made a lead look deleted while it kept feeding
    // every dashboard, count and report — the row was gone from the screen and
    // nowhere else. An empty `deleted` array now means "nothing was deleted",
    // not "assume they all were", and a hard failure removes nothing at all.
    try {
      const res = await crmService.bulkDeleteLeads(ids);
      const removed = Array.isArray(res?.deleted) ? res.deleted : [];
      if (removed.length) {
        setLeads((prev) => prev.filter((l) => !removed.includes(l.id)));
        publishLeadsChanged('deleted', removed);
      }
      const failed = res?.failed || [];
      if (failed.length) {
        setError(
          failed.length === ids.length
            ? `We couldn’t delete ${failed.length === 1 ? 'this lead' : 'these leads'}: ${failed[0].error}`
            : `Deleted ${removed.length} of ${ids.length}. ${failed.length} could not be deleted: ${failed[0].error}`,
        );
      }
    } catch (err: any) {
      setError(describeApiError(err, 'We couldn’t delete the selected leads. Please try again.'));
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
    canDelete: canDeleteLead,
    onOwnerChange: handleOwnerChange,
    onStatusChange: handleStatusChange,
    onDelete: (lead) => setShowDeleteConfirm(lead.id),
    onOpen: (lead) => navigate(`${lead.id}`),
    formatDate: formatters.formatDate,
    onInlineEdit: handleInlineEdit,
    ratings: ratingEnabled ? ratings : undefined,
  }), [users, leadStages, canUpdateLead, canDeleteLead, handleOwnerChange, handleStatusChange, navigate, formatters, handleInlineEdit, ratingEnabled, ratings]);

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
    // Destructive bulk action — gate on leads.delete, fail closed. Previously
    // shown to every user regardless of permission (backend rejects it, but the
    // control shouldn't be offered in the first place). See canDeleteLead above.
    ...(canDeleteLead ? [{
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger' as const,
      onClick: (ids: string[]) => handleBulkDelete(ids),
    }] : []),
  ].filter((a: any) => !a.options || a.options.length > 0),
  [users, leadStages, leadSources, canDeleteLead, handleBulkOwnerChange, handleBulkStatusChange, handleBulkSourceChange, handleBulkExport, handleBulkDelete]);

  const ownerScope: 'all' | 'mine' | 'unassigned' =
    filters.owner === UNASSIGNED_OWNER ? 'unassigned' : shell?.user?.id && filters.owner === shell.user.id ? 'mine' : 'all';
  const handleOwnerScope = useCallback((scope: string) => {
    setFilters((prev) => ({
      ...prev,
      owner: scope === 'unassigned' ? UNASSIGNED_OWNER : scope === 'mine' && shell?.user?.id ? shell.user.id : 'All',
    }));
    setCurrentPage(1);
    setActiveViewId(null);
  }, [shell?.user?.id]);

  const leadFilterConfig: ListFilterConfig = {
    fields: [
      { key: 'status', label: 'Status', type: 'select', quick: true, options: leadStages.map((st) => ({ value: st.name, label: st.name, count: statusCounts[st.name] ?? 0 })) },
      { key: 'owner', label: 'Owner', type: 'select', quick: true, options: [{ value: UNASSIGNED_OWNER, label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.full_name }))] },
      {
        key: 'dateRange', label: 'Date range', type: 'select', quick: true,
        options: ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month', 'Last Month', 'Custom'].map((v) => ({ value: v, label: v === 'Custom' ? 'Custom Range' : v })),
      },
      { key: 'customDates', label: 'Custom dates', type: 'daterange' },
      { key: 'creator', label: 'Created by', type: 'select', options: users.map((u) => ({ value: u.id, label: u.full_name })) },
      ...(ratingEnabled && ratings.length > 0 ? [{ key: 'rating', label: 'Rating', type: 'select' as const, options: ratings.map((r) => ({ value: r.id, label: r.label })) }] : []),
      {
        key: 'advanced', label: 'Advanced', type: 'custom',
        formatValue: () => `Advanced (${advancedFilter ? countActiveRules(advancedFilter) : 0})`,
        render: () => (
          <LeadFilterBuilder value={advancedFilter} onApply={handleApplyAdvancedFilter} onClose={() => undefined} />
        ),
      },
    ],
    values: {
      ...(filters.status !== 'All' ? { status: filters.status } : {}),
      ...(filters.owner !== 'All' ? { owner: filters.owner } : {}),
      ...(filters.dateRange !== 'All' ? { dateRange: filters.dateRange } : {}),
      ...(filters.customDateStart || filters.customDateEnd ? { customDates: { start: filters.customDateStart, end: filters.customDateEnd } } : {}),
      ...(filters.creator !== 'All' ? { creator: filters.creator } : {}),
      ...(filters.rating !== 'All' ? { rating: filters.rating } : {}),
      ...(advancedFilter ? { advanced: 'on' } : {}),
    } as FilterValues,
    onChange: (next: FilterValues) => {
      if (advancedFilter && !next.advanced) setAdvancedFilter(null);
      const cd = next.customDates as { start?: string; end?: string } | null | undefined;
      setFilters((prev) => ({
        ...prev,
        status: (next.status as string) || 'All',
        owner: (next.owner as string) || 'All',
        creator: (next.creator as string) || 'All',
        rating: (next.rating as string) || 'All',
        customDateStart: cd?.start ?? '',
        customDateEnd: cd?.end ?? '',
        dateRange: cd && (cd.start || cd.end) ? 'Custom' : ((next.dateRange as string) || 'All'),
      }));
      setCurrentPage(1);
      setActiveViewId(null);
    },
    onClear: clearFilters,
  };

  const hasLeads = leads.length > 0;
  const isFilteredEmpty = !isLoading && !error && hasLeads && sandboxLeads.length === 0 && hasActiveFilters;
  const isTrulyEmpty = !isLoading && !error && !hasLeads;

  return (
    <div ref={listAnchorRef}>
      <ListPageTemplate
        trail={[]}
        title="Leads & Accounts"
        count={leads.length}
        primaryAction={
          canCreateLead ? (
            <QuotaGate
              quotaKey="max_contacts"
              moduleCode="crm"
              used={leads.length}
              limit={quotaData?.limit ?? 0}
              isUnlimited={quotaData?.is_unlimited}
              disableOnExceeded
            >
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus size={16} aria-hidden="true" />
                New Lead
              </Button>
            </QuotaGate>
          ) : undefined
        }
        headerSecondaryActions={[
          ...(canExportLeads ? [<ExportMenu key="export" label="Export leads" onExport={(format) => exportService.leads({ status: filters.status }, format)} />] : []),
        ]}
        overflowActions={[
          { label: activeViewId ? `Saved views (${savedViews.find((v) => v.id === activeViewId)?.name ?? 'Views'})` : 'Saved views', icon: <Bookmark size={16} aria-hidden="true" />, onSelect: () => setOpenDropdown('views') },
          ...(canImportLeads ? [{ label: 'Import', icon: <UploadCloud size={16} aria-hidden="true" />, onSelect: () => setIsImportOpen(true) }] : []),
        ]}
        views={
          <SegmentedControl
            aria-label="Lead scope"
            data-testid="leads-scope-views"
            value={ownerScope}
            onChange={handleOwnerScope}
            options={[
              { value: 'all', label: 'All' },
              { value: 'mine', label: 'My', disabled: !shell?.user?.id },
              { value: 'unassigned', label: 'Unassigned' },
            ]}
          />
        }
        search={
          <SearchInput
            placeholder="Search leads…"
            value={filters.search}
            onChange={(v: string) => setFilter('search', v)}
          />
        }
        filterConfig={leadFilterConfig}
        toolbarEnd={
          <div ref={setGridControlsSlot} className="flex shrink-0 items-center" data-slot="grid-controls" />
        }
        loading={isLoading && !hasLeads}
        isEmpty={isTrulyEmpty}
        empty={
          canCreateLead ? (
            <EmptyState
              title="No leads yet"
              description="Create your first lead or import a list to get started."
              action={{ label: 'New Lead', onClick: () => setIsModalOpen(true) }}
            />
          ) : (
            <EmptyState title="No leads yet" />
          )
        }
        isFilteredEmpty={isFilteredEmpty}
        onClearFilters={clearFilters}
        pagination={
          sandboxLeads.length > 0 ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages || 1}
              totalItems={sandboxLeads.length}
              pageSize={pageSize}
              pageSizeOptions={[25, 50, 100, 250]}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
          ) : undefined
        }
      >
        {/* Sandbox notice */}
        {isSandboxMode && isLimited(filteredLeads.length) && (
          <div className="mb-3 flex items-center gap-2 rounded-nb border border-warning/25 bg-warning/10 px-4 py-2 text-sm text-warning">
            <span className="font-semibold">Sandbox:</span>
            <span>Showing {sandboxEntryLimit} of {filteredLeads.length} leads. Switch to Production to view all records.</span>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="mb-4 flex items-center gap-2 rounded-nb border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
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
          controlsSlot={gridControlsSlot}
        />
      </ListPageTemplate>

      <Modal
        open={openDropdown === 'views'}
        onClose={() => setOpenDropdown(null)}
        title="Saved views"
        size="md"
        data-testid="saved-views-modal"
      >
        <div className="flex flex-col gap-nb-2">
          {savedViews.length === 0 && <p className="text-nb-body text-fg-muted">No saved views yet</p>}
          {savedViews.map((view) => (
            <div key={view.id} className="flex items-center gap-nb-2" data-testid={`saved-view-${view.id}`}>
              {renamingViewId === view.id ? (
                <>
                  <TextField
                    autoFocus
                    name="rename-view"
                    aria-label="Rename view"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { handleRenameView(view.id, renameValue); setRenamingViewId(null); }
                      if (e.key === 'Escape') setRenamingViewId(null);
                    }}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={() => { handleRenameView(view.id, renameValue); setRenamingViewId(null); }}>Save</Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className={`min-w-0 flex-1 !justify-start ${activeViewId === view.id ? 'text-primary' : ''}`}
                    onClick={() => { handleApplyView(view); setOpenDropdown(null); }}
                  >
                    {view.is_default && <Star size={12} className="shrink-0 fill-warning text-warning" aria-hidden="true" />}
                    <span className="truncate">{view.name}</span>
                    {view.is_shared && <Share2 size={12} className="shrink-0 text-fg-muted" aria-label="Shared with your team" />}
                  </Button>
                  <IconButton label="Rename view" icon={<Pencil size={14} />} onClick={() => { setRenamingViewId(view.id); setRenameValue(view.name); }} />
                  <IconButton label="Duplicate view" icon={<Copy size={14} />} onClick={() => handleDuplicateView(view.id)} />
                  <IconButton label={view.is_default ? 'Default view' : 'Set as default'} icon={<Star size={14} className={view.is_default ? 'fill-warning text-warning' : ''} />} onClick={() => handleSetDefaultView(view.id)} />
                  <IconButton label={view.is_shared ? 'Unshare view' : 'Share view'} icon={<Share2 size={14} className={view.is_shared ? 'text-primary' : ''} />} onClick={() => handleToggleShareView(view.id)} />
                  <IconButton label="Delete view" variant="danger" icon={<X size={14} />} onClick={() => handleDeleteView(view.id)} />
                </>
              )}
            </div>
          ))}
          {showSaveViewInput ? (
            <div className="flex items-center gap-nb-2">
              <TextField
                autoFocus
                name="save-view-name"
                placeholder="View name…"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); if (e.key === 'Escape') setShowSaveViewInput(false); }}
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleSaveView}>Save</Button>
            </div>
          ) : (
            <Button variant="secondary" className="!justify-start" onClick={() => setShowSaveViewInput(true)}>
              <BookmarkPlus size={14} aria-hidden="true" />
              Save current view
            </Button>
          )}
        </div>
      </Modal>

      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchInitialData}
        existingLeads={leads.map((l) => l.company_name)}
      />
      {canImportLeads && (
        <ImportHub
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImported={fetchInitialData}
        />
      )}

      <ConfirmDialog
        open={!!showDeleteConfirm}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This will also remove all associated notes, activities, and documents. This action cannot be undone."
        confirmLabel="Delete"
        intent="danger"
        onConfirm={() => (showDeleteConfirm ? handleDeleteLead(showDeleteConfirm) : undefined)}
        onCancel={() => setShowDeleteConfirm(null)}
      />

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
