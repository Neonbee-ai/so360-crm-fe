import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadDetailPanel } from './LeadDetailPanel';
import type { Lead } from '../../types/crm';

const mockGetDeals = vi.fn();
const mockGetTasks = vi.fn();
const mockGetActivities = vi.fn();
const mockGetUsers = vi.fn();
const mockGetPartners = vi.fn();
const mockGetSourceTypes = vi.fn();
const mockGetLeadById = vi.fn();
const mockUpdateTask = vi.fn();
const mockUseEntityTimeline = vi.fn();

vi.mock('../../pages/components/timeline/useEntityTimeline', () => ({
  useEntityTimeline: (...a: any[]) => mockUseEntityTimeline(...a),
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getDealsByLeadId: (...a: any[]) => mockGetDeals(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasks(...a),
    getActivitiesByLeadIdPaginated: (...a: any[]) => mockGetActivities(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getPartners: (...a: any[]) => mockGetPartners(...a),
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
  },
  settingsApi: {
    sourceTypes: {
      getAll: (...a: any[]) => mockGetSourceTypes(...a),
    },
  },
}));

vi.mock('../../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatDate: (d: string, options: any = {}) =>
      options.hour
        ? `${new Date(d).toISOString().slice(0, 10)} ${new Date(d).toISOString().slice(11, 16)}`
        : new Date(d).toISOString().slice(0, 10),
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

const makeLead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    company_name: 'Acme Corp',
    contact_name: 'Jane Doe',
    contact_email: 'jane@acme.com',
    phone: '555-0100',
    source: 'Website',
    status: 'New',
    owner: { id: 'u1', full_name: 'Alice', email: 'a@a.com' },
    created_at: '2026-01-01T00:00:00Z',
    activities: [],
    notes: [],
    ...(over as object),
  } as Lead);

const render_ = (
  lead: Lead | null,
  overrides: {
    onNavigate?: (lead: Lead) => void;
    onNavigateDeal?: (deal: any) => void;
    onNavigateTask?: (task: any) => void;
  } = {},
) =>
  render(
    <LeadDetailPanel
      lead={lead}
      onClose={vi.fn()}
      onNavigate={overrides.onNavigate ?? vi.fn()}
      onNavigateDeal={overrides.onNavigateDeal ?? vi.fn()}
      onNavigateTask={overrides.onNavigateTask ?? vi.fn()}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDeals.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([]);
  mockGetActivities.mockResolvedValue({ data: [], total: 0 });
  mockGetUsers.mockResolvedValue([]);
  mockGetPartners.mockResolvedValue([]);
  mockGetSourceTypes.mockResolvedValue([]);
  mockUpdateTask.mockResolvedValue({});
  mockUseEntityTimeline.mockReturnValue({
    events: [], loading: false, error: null, hasMore: false, refetch: vi.fn(),
  });
  mockGetLeadById.mockResolvedValue(undefined);
});

describe('LeadDetailPanel — tabs', () => {
  it('renders all six tabs', () => {
    render_(makeLead());
    ['Overview', 'Activity', 'Sales', 'Tasks', 'Marketing', 'Audit'].forEach((t) =>
      expect(screen.getByText(t)).toBeInTheDocument(),
    );
  });

  it('does not fetch linked records until their tab is opened', () => {
    render_(makeLead());
    expect(mockGetDeals).not.toHaveBeenCalled();
    expect(mockGetTasks).not.toHaveBeenCalled();
    expect(mockGetActivities).not.toHaveBeenCalled();
  });
});

describe('LeadDetailPanel — navigation to full profile', () => {
  it('exposes exactly one action that navigates to the full lead profile', () => {
    // Regression: the panel previously had a redundant top-right external-link
    // icon that navigated to the same route as "View full profile".
    const onNavigate = vi.fn();
    render_(makeLead(), { onNavigate });
    const profileButton = screen.getByText('View full profile');
    fireEvent.click(profileButton);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle('Open full page')).not.toBeInTheDocument();
  });
});

describe('LeadDetailPanel — Activity (timeline) tab', () => {
  it('renders the SAME unified entity timeline the full Lead Detail page uses', async () => {
    // Regression: the panel used to call the narrow /activities endpoint, so
    // notes/deals/documents recorded elsewhere never appeared and it wrongly
    // claimed "No activity recorded yet" while the full profile showed events.
    mockUseEntityTimeline.mockReturnValue({
      events: [
        { id: 'e1', title: 'Note added', description: 'Called and left voicemail', created_at: '2026-01-02T00:00:00Z', module: 'crm', actor_name: 'Alice' },
      ],
      loading: false, error: null, hasMore: false, refetch: vi.fn(),
    });
    render_(makeLead());
    fireEvent.click(screen.getByText('Activity'));
    expect(mockUseEntityTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'lead', entityId: 'lead-1' }),
    );
    expect(await screen.findByText('Called and left voicemail')).toBeInTheDocument();
  });

  it('shows an empty state only once the timeline has loaded and there are none', async () => {
    render_(makeLead());
    fireEvent.click(screen.getByText('Activity'));
    expect(await screen.findByText(/no activity recorded yet/i)).toBeInTheDocument();
  });

  it('shows a retry action instead of the empty state when the timeline fails to load', async () => {
    mockUseEntityTimeline.mockReturnValue({
      events: [], loading: false, error: 'boom', hasMore: false, refetch: vi.fn(),
    });
    render_(makeLead());
    fireEvent.click(screen.getByText('Activity'));
    expect(await screen.findByText(/couldn't load activity/i)).toBeInTheDocument();
    expect(screen.queryByText(/no activity recorded yet/i)).not.toBeInTheDocument();
  });
});

describe('LeadDetailPanel — Sales tab', () => {
  it('fetches and renders linked deals', async () => {
    mockGetDeals.mockResolvedValue([
      {
        id: 'd1', name: 'Big Deal', value: 5000, stage: 'Qualified',
        expected_close_date: '2026-02-01T00:00:00Z', invoice_number: 'INV-9',
        owner: { id: 'u1', full_name: 'Alice' }, notes: [], activities: [], created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Sales'));
    await waitFor(() => expect(mockGetDeals).toHaveBeenCalledWith('lead-1'));
    expect(await screen.findByText('Big Deal')).toBeInTheDocument();
    expect(screen.getByText('$5000')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('shows an empty state when there are no deals', async () => {
    render_(makeLead());
    fireEvent.click(screen.getByText('Sales'));
    expect(await screen.findByText(/no deals linked/i)).toBeInTheDocument();
  });

  it('clicking a deal card navigates using the deal, not the lead', async () => {
    // Regression: previously the click handler called onNavigate(lead), which
    // always routed back to the Lead Detail page regardless of which deal was clicked.
    mockGetDeals.mockResolvedValue([
      { id: 'd1', name: 'Big Deal', value: 5000, stage: 'Qualified', owner: { id: 'u1', full_name: 'Alice' }, notes: [], activities: [], created_at: '2026-01-01T00:00:00Z' },
    ]);
    const onNavigate = vi.fn();
    const onNavigateDeal = vi.fn();
    render_(makeLead(), { onNavigate, onNavigateDeal });
    fireEvent.click(screen.getByText('Sales'));
    fireEvent.click(await screen.findByText('Big Deal'));
    expect(onNavigateDeal).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('LeadDetailPanel — Tasks tab', () => {
  it('fetches and renders linked tasks', async () => {
    mockGetTasks.mockResolvedValue([
      {
        id: 't1', title: 'Call back', due_date: '2026-02-01T00:00:00Z', status: 'OPEN',
        type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Tasks'));
    await waitFor(() => expect(mockGetTasks).toHaveBeenCalledWith('lead-1'));
    expect(await screen.findByText('Call back')).toBeInTheDocument();
  });

  it('shows an empty state when there are no tasks', async () => {
    render_(makeLead());
    fireEvent.click(screen.getByText('Tasks'));
    expect(await screen.findByText(/no tasks for this lead/i)).toBeInTheDocument();
  });

  it('opens the Task Detail record when a task card is clicked', async () => {
    const onNavigateTask = vi.fn();
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Call back', due_date: '2099-02-01T00:00:00Z', status: 'OPEN', type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2026-01-01T00:00:00Z' },
    ]);
    render_(makeLead(), { onNavigateTask });
    fireEvent.click(screen.getByText('Tasks'));
    fireEvent.click(await screen.findByText('Call back'));
    expect(onNavigateTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('saves an inline status change without navigating away', async () => {
    const onNavigateTask = vi.fn();
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Call back', due_date: '2099-02-01T00:00:00Z', status: 'OPEN', type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2026-01-01T00:00:00Z' },
    ]);
    render_(makeLead(), { onNavigateTask });
    fireEvent.click(screen.getByText('Tasks'));
    const select = (await screen.findByLabelText('Status for Call back')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'DONE' } });
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'DONE' }));
    expect(onNavigateTask).not.toHaveBeenCalled();
  });

  it('renders the task priority persisted by the backend', async () => {
    // Regression: tasks had no priority column, so every read faked 'medium'
    // and the Quick View could not show a real one (crm-be migration 048).
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Call back', due_date: '2099-02-01T00:00:00Z', status: 'OPEN', priority: 'urgent', type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2026-01-01T00:00:00Z' },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Tasks'));
    expect(await screen.findByText('urgent')).toBeInTheDocument();
  });

  it('omits the priority chip entirely for a task that carries none', async () => {
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Call back', due_date: '2099-02-01T00:00:00Z', status: 'OPEN', type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2026-01-01T00:00:00Z' },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Tasks'));
    expect(await screen.findByText('Call back')).toBeInTheDocument();
    expect(screen.queryByText(/^(low|medium|high|urgent)$/)).not.toBeInTheDocument();
  });

  it('flags a past-due, unfinished task as overdue', async () => {
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Overdue thing', due_date: '2020-01-01T00:00:00Z', status: 'OPEN', type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2019-01-01T00:00:00Z' },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Tasks'));
    expect(await screen.findByText(/^Overdue \d+d$/)).toBeInTheDocument();
  });

  it('does NOT flag a completed task as overdue even when its due date has passed', async () => {
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Done thing', due_date: '2020-01-01T00:00:00Z', status: 'DONE', type: 'CALL', assigned_to: { id: 'u1', full_name: 'Alice' }, created_at: '2019-01-01T00:00:00Z' },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Tasks'));
    expect(await screen.findByText('Done thing')).toBeInTheDocument();
    expect(screen.queryByText(/^Overdue \d+d$/)).not.toBeInTheDocument();
  });
});

describe('LeadDetailPanel — Marketing tab', () => {
  it('renders attribution from the lead (no fetch)', () => {
    render_(makeLead({ acquisition_source: 'Google Ads', channel: 'web' } as Partial<Lead>));
    fireEvent.click(screen.getByText('Marketing'));
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Acquisition Source')).toBeInTheDocument();
    expect(mockGetDeals).not.toHaveBeenCalled();
  });

  it('shows the empty-attribution note when only a source exists', () => {
    render_(makeLead()); // source only, no acquisition/channel/campaign/referral
    fireEvent.click(screen.getByText('Marketing'));
    expect(screen.getByText(/no additional marketing attribution/i)).toBeInTheDocument();
  });
});

describe('LeadDetailPanel — Sales tab (optional fields)', () => {
  it('renders a deal that has no close date or invoice ref', async () => {
    mockGetDeals.mockResolvedValue([
      {
        id: 'd2', name: 'Lean Deal', value: 100, stage: 'Lead',
        owner: { id: 'u1', full_name: 'Alice' }, notes: [], activities: [], created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render_(makeLead());
    fireEvent.click(screen.getByText('Sales'));
    expect(await screen.findByText('Lean Deal')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.queryByText(/Close /)).toBeNull();
  });
});

describe('LeadDetailPanel — Audit tab', () => {
  it('shows only system/state-change events', async () => {
    mockGetActivities.mockResolvedValue({
      data: [
        { id: 'a1', type: 'STATUS_CHANGE', notes: 'Moved to Qualified', created_at: '2026-01-02T00:00:00Z', author: { id: 'u1', full_name: 'Alice' } },
        { id: 'a2', type: 'NOTE', notes: 'just a note', created_at: '2026-01-01T00:00:00Z', author: { id: 'u1', full_name: 'Alice' } },
      ],
      total: 2,
    });
    render_(makeLead());
    fireEvent.click(screen.getByText('Audit'));
    expect(await screen.findByText(/status change/i)).toBeInTheDocument();
    expect(screen.queryByText('just a note')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no audit events', async () => {
    render_(makeLead());
    fireEvent.click(screen.getByText('Audit'));
    expect(await screen.findByText(/no audit events/i)).toBeInTheDocument();
  });
});

describe('LeadDetailPanel — relational field resolution (Overview)', () => {
  // Regression: Owner/Referred By/Source previously rendered whatever the lead
  // object carried at fetch time — a stale "Unknown User" placeholder, a raw
  // referrer UUID, or a raw source code — instead of resolving them the same
  // way the Lead Detail page does.

  it('overrides a stale "Unknown User" owner placeholder with the resolved name once users load', async () => {
    mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Alice Johnson', email: 'alice@acme.com' }]);
    render_(
      makeLead({ owner: { id: 'u1', full_name: 'Unknown User', email: '' } } as Partial<Lead>),
    );
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Unknown User')).not.toBeInTheDocument();
  });

  it('falls back to the lead-carried owner name when the users list has no match', async () => {
    mockGetUsers.mockResolvedValue([]);
    render_(makeLead({ owner: { id: 'u1', full_name: 'Alice', email: '' } } as Partial<Lead>));
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('resolves a referred_by UUID to the referring partner\'s company name, not the raw id', async () => {
    mockGetPartners.mockResolvedValue([
      { id: 'p1', company_name: 'Apple Inc' },
    ]);
    render_(makeLead({ referred_by: 'p1' } as Partial<Lead>));
    expect(await screen.findByText('Apple Inc')).toBeInTheDocument();
    expect(screen.queryByText('p1')).not.toBeInTheDocument();
  });

  it('shows "—" rather than the raw id when referred_by cannot be resolved to a partner', async () => {
    mockGetPartners.mockResolvedValue([]);
    render_(makeLead({ referred_by: 'p1' } as Partial<Lead>));
    await waitFor(() => expect(mockGetPartners).toHaveBeenCalled());
    expect(await screen.findByText('Referred By')).toBeInTheDocument();
    expect(screen.queryByText('p1')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the configured source label instead of the raw source code', async () => {
    mockGetSourceTypes.mockResolvedValue([
      { id: 's1', value: 'web_form', label: 'Website Form', is_system: true, is_active: true, sort_order: 0 },
    ]);
    render_(makeLead({ source: 'web_form' } as Partial<Lead>));
    expect(await screen.findByText('Website Form')).toBeInTheDocument();
    expect(screen.queryByText('web_form')).not.toBeInTheDocument();
  });

  it('falls back to the raw source code when no matching source type is configured', async () => {
    mockGetSourceTypes.mockResolvedValue([]);
    render_(makeLead({ source: 'web_form' } as Partial<Lead>));
    expect(await screen.findByText('web_form')).toBeInTheDocument();
  });
});

describe('LeadDetailPanel — relational field resolution (Marketing tab)', () => {
  it('resolves referred_by and source the same way as the Overview tab', async () => {
    mockGetPartners.mockResolvedValue([{ id: 'p1', company_name: 'Apple Inc' }]);
    mockGetSourceTypes.mockResolvedValue([
      { id: 's1', value: 'web_form', label: 'Website Form', is_system: true, is_active: true, sort_order: 0 },
    ]);
    render_(makeLead({ source: 'web_form', referred_by: 'p1' } as Partial<Lead>));
    fireEvent.click(screen.getByText('Marketing'));
    expect(await screen.findByText('Apple Inc')).toBeInTheDocument();
    // "Website Form" also appears in the always-visible header status row, so
    // there are two matches once the Marketing tab's own Source row mounts.
    expect(screen.getAllByText('Website Form').length).toBeGreaterThan(0);
  });
});

// ── Quick Overview data quality ──────────────────────────────────────────────
// Regression cover for "Lead Quick Overview shows UUIDs, ISO timestamps and raw
// database values". The drawer dumped every key of the raw meta_data bucket
// through String(val), so the merge flow's internal bookkeeping leaked to users.
describe('Given a lead that was merged into another record', () => {
  const MERGED_ID = 'c4deff86-ba44-43b0-9013-4d7965298514';
  const mergedLead = makeLead({
    id: 'lead-merged',
    custom_fields: {
      merged_into: MERGED_ID,
      merged_at: '2026-07-31T14:05:12.625Z',
      merged_by: 'a1b2c3d4-0000-4000-8000-000000000000',
      preferred_contact_method: 'Email',
    },
  } as any);

  it('When the panel renders / Then no UUID is visible anywhere', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ id: MERGED_ID, company_name: 'Apple Inc' }));
    render_(mergedLead);
    await waitFor(() => expect(screen.getByText('Merged Into')).toBeInTheDocument());
    expect(document.body.textContent).not.toContain(MERGED_ID);
    expect(document.body.textContent).not.toContain('a1b2c3d4-0000-4000-8000-000000000000');
  });

  it('When the merge target resolves / Then its business name is shown instead of the id', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ id: MERGED_ID, company_name: 'Apple Inc' }));
    render_(mergedLead);
    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument());
  });

  it('When the merge target is clicked / Then it navigates to that record', async () => {
    const onNavigate = vi.fn();
    mockGetLeadById.mockResolvedValue(makeLead({ id: MERGED_ID, company_name: 'Apple Inc' }));
    render_(mergedLead, { onNavigate });
    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Apple Inc'));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: MERGED_ID }));
  });

  it('When the merge target no longer exists / Then it degrades to readable text, never the id', async () => {
    mockGetLeadById.mockResolvedValue(undefined);
    render_(mergedLead);
    await waitFor(() => expect(screen.getByText('Merged Into')).toBeInTheDocument());
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(MERGED_ID);
  });

  it('When the merge timestamp is shown / Then it is formatted, not a raw ISO string', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ id: MERGED_ID, company_name: 'Apple Inc' }));
    render_(mergedLead);
    await waitFor(() => expect(screen.getByText('Merged At')).toBeInTheDocument());
    expect(document.body.textContent).not.toContain('2026-07-31T14:05:12.625Z');
    expect(screen.getByText('2026-07-31 14:05')).toBeInTheDocument();
  });

  it('When the Additional Fields list renders / Then system merge keys are excluded but user fields survive', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ id: MERGED_ID, company_name: 'Apple Inc' }));
    render_(mergedLead);
    await waitFor(() => expect(screen.getByText('Additional Fields')).toBeInTheDocument());
    expect(screen.getByText('Preferred Contact Method')).toBeInTheDocument();
    expect(screen.queryByText('Merged By')).not.toBeInTheDocument();
  });
});

describe('Given a lead whose meta_data holds only system keys', () => {
  it('When the panel renders / Then the Additional Fields block is omitted entirely', async () => {
    mockGetLeadById.mockResolvedValue(undefined);
    render_(makeLead({ custom_fields: { merged_at: '2026-07-31T14:05:12.625Z' } } as any));
    await waitFor(() => expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0));
    expect(screen.queryByText('Additional Fields')).not.toBeInTheDocument();
  });
});
