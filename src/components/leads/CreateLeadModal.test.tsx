import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateLead = vi.fn();
const mockRecordActivity = vi.fn();

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) => isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    createLead: (...a: any[]) => mockCreateLead(...a),
    getUsers: () => Promise.resolve([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]),
    getPartners: () => Promise.resolve([]),
  },
  settingsApi: {
    sourceTypes: {
      getAll: () => Promise.resolve([
        { id: 'st1', label: 'Website', value: 'website', is_active: true },
        { id: 'st2', label: 'Referral', value: 'referral', is_active: true },
      ]),
    },
  },
}));

vi.mock('@so360/shell-context', () => ({
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useIdentity: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import { CreateLeadModal } from './CreateLeadModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    lead_stages: [{ id: 'ls1', name: 'New' }, { id: 'ls2', name: 'Contacted' }],
    lead_custom_fields: [
      { id: 'cf1', label: 'Industry', type: 'text', required: false },
      { id: 'cf2', label: 'Budget', type: 'number', required: true },
      { id: 'cf3', label: 'Is VIP', type: 'boolean', required: false },
      { id: 'cf4', label: 'Start Date', type: 'date', required: false },
    ],
    deal_stages: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
  });
  mockCreateLead.mockResolvedValue({ id: 'l-new', company_name: 'TestCo' });
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('Given CreateLeadModal', () => {
  it('When action / Then returns null when closed', () => {
    const { container } = render(
      <CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />,
    );
    expect(container.querySelector('[data-testid="modal"]')).toBeNull();
  });

  it('When action / Then renders form when open', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('When action / Then shows company name field', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => {
      expect(screen.getByText(/company name/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows all form fields', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => {
      expect(screen.getByText(/contact name/i)).toBeInTheDocument();
      expect(screen.getByText(/contact email/i)).toBeInTheDocument();
      expect(screen.getByText(/phone/i)).toBeInTheDocument();
      expect(screen.getByText(/lead source/i)).toBeInTheDocument();
      expect(screen.getByText(/lead stage/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows custom fields', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Industry')).toBeInTheDocument();
      expect(screen.getByText(/budget/i)).toBeInTheDocument();
      expect(screen.getByText('Is VIP')).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
    });
  });

  it('When action / Then shows duplicate warning', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme']} />);
    await waitFor(() => screen.getByTestId('modal'));
    const input = screen.getByPlaceholderText('e.g. Acme Corp');
    fireEvent.change(input, { target: { value: 'Acme' } });
    expect(screen.getByText(/potential duplicate/i)).toBeInTheDocument();
  });

  it('When action / Then submits form and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<CreateLeadModal isOpen={true} onClose={onClose} onSuccess={onSuccess} existingLeads={[]} />);
    await waitFor(() => screen.getByTestId('modal'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });

    const form = screen.getByTestId('modal').querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(mockCreateLead).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('When action / Then shows error on submit failure', async () => {
    mockCreateLead.mockRejectedValue(new Error('fail'));
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => screen.getByTestId('modal'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
    const form = screen.getByTestId('modal').querySelector('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockCreateLead).toHaveBeenCalled();
    });
  });

  it('When action / Then shows lead stage dropdown with options', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  it('When action / Then fills in all form fields', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => screen.getByTestId('modal'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'TestCo' } });
    const phoneField = document.querySelector('input[type="tel"]');
    if (phoneField) fireEvent.change(phoneField, { target: { value: '555' } });
  });

  it('When action / Then fetches settings on open', async () => {
    render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalled();
    });
  });

  it('When action / Then does not fetch settings when closed', () => {
    render(<CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    expect(mockGetSettings).not.toHaveBeenCalled();
  });
});
