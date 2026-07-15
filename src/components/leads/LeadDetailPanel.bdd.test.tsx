import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadDetailPanel } from './LeadDetailPanel';
import type { Lead } from '../../types/crm';

const mockGetDeals = vi.fn();
const mockGetTasks = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getDealsByLeadId: (...a: any[]) => mockGetDeals(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasks(...a),
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

const render_ = (lead: Lead | null) =>
  render(<LeadDetailPanel lead={lead} onClose={vi.fn()} onNavigate={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDeals.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([]);
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
});

describe('LeadDetailPanel — Audit tab', () => {
  it('shows only system/state-change events', () => {
    render_(
      makeLead({
        activities: [
          { id: 'a1', type: 'STATUS_CHANGE', notes: 'Moved to Qualified', created_at: '2026-01-02T00:00:00Z', author: { id: 'u1', full_name: 'Alice' } },
          { id: 'a2', type: 'NOTE', notes: 'just a note', created_at: '2026-01-01T00:00:00Z', author: { id: 'u1', full_name: 'Alice' } },
        ],
      } as Partial<Lead>),
    );
    fireEvent.click(screen.getByText('Audit'));
    expect(screen.getByText(/status change/i)).toBeInTheDocument();
    expect(screen.queryByText('just a note')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no audit events', () => {
    render_(makeLead());
    fireEvent.click(screen.getByText('Audit'));
    expect(screen.getByText(/no audit events/i)).toBeInTheDocument();
  });
});
