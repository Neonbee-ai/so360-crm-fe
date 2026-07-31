import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadDetailPanel } from './LeadDetailPanel';
import type { Lead } from '../../types/crm';

const mockGetDeals = vi.fn();
const mockGetTasks = vi.fn();
const mockGetActivities = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getDealsByLeadId: (...a: any[]) => mockGetDeals(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasks(...a),
    getActivitiesByLeadIdPaginated: (...a: any[]) => mockGetActivities(...a),
  },
}));

vi.mock('../../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatDate: (d: string) => new Date(d).toISOString().slice(0, 10),
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
  overrides: { onNavigate?: (lead: Lead) => void; onNavigateDeal?: (deal: any) => void } = {},
) =>
  render(
    <LeadDetailPanel
      lead={lead}
      onClose={vi.fn()}
      onNavigate={overrides.onNavigate ?? vi.fn()}
      onNavigateDeal={overrides.onNavigateDeal ?? vi.fn()}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDeals.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([]);
  mockGetActivities.mockResolvedValue({ data: [], total: 0 });
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

describe('LeadDetailPanel — Activity (timeline) tab', () => {
  it('fetches and renders the lead activity timeline', async () => {
    mockGetActivities.mockResolvedValue({
      data: [
        { id: 'a1', type: 'NOTE', notes: 'Called and left voicemail', created_at: '2026-01-02T00:00:00Z', author: { id: 'u1', full_name: 'Alice' } },
      ],
      total: 1,
    });
    render_(makeLead());
    fireEvent.click(screen.getByText('Activity'));
    await waitFor(() => expect(mockGetActivities).toHaveBeenCalledWith('lead-1', 10, 0));
    expect(await screen.findByText('Called and left voicemail')).toBeInTheDocument();
  });

  it('shows an empty state only once activities have loaded and there are none', async () => {
    render_(makeLead());
    fireEvent.click(screen.getByText('Activity'));
    expect(await screen.findByText(/no activity recorded yet/i)).toBeInTheDocument();
  });

  it('fetches activities scoped to the selected lead, not read off the lead object', async () => {
    // Regression: the lead object itself carries no activities — the panel
    // must fetch them independently instead of reading a `lead.activities` field.
    mockGetActivities.mockResolvedValue({
      data: [{ id: 'a1', type: 'CALL', notes: 'Follow-up call', created_at: '2026-01-02T00:00:00Z' }],
      total: 1,
    });
    render_(makeLead({ activities: undefined } as unknown as Partial<Lead>));
    fireEvent.click(screen.getByText('Activity'));
    expect(await screen.findByText('Follow-up call')).toBeInTheDocument();
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
