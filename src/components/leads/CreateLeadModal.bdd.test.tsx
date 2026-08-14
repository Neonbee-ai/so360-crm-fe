import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateLead = vi.fn();
const mockRecordActivity = vi.fn();

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    createLead: (...a: any[]) => mockCreateLead(...a),
    getUsers: () => Promise.resolve([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]),
    getPartners: () => Promise.resolve([
      { id: 'p1', company_name: 'Acme Corp', contact_name: 'John' },
      { id: 'p2', company_name: 'Beta LLC', contact_name: 'Jane' },
    ]),
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
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useIdentity: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import { CreateLeadModal } from './CreateLeadModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    lead_stages: [{ id: 'ls1', name: 'New' }, { id: 'ls2', name: 'Contacted' }],
    lead_custom_fields: [
      { id: 'cf1', label: 'Industry', type: 'text', required: false },
      { id: 'cf2', label: 'Budget', type: 'number', required: true },
    ],
    deal_stages: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
  });
  mockCreateLead.mockResolvedValue({ id: 'l-new', company_name: 'NewCo' });
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('CreateLeadModal', () => {
  describe('Given the modal is closed', () => {
    it('When isOpen is false / Then renders nothing', () => {
      const { container } = render(
        <CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />,
      );
      expect(container.querySelector('[data-testid="modal"]')).toBeNull();
    });

    it('When isOpen is false / Then does not fetch settings', () => {
      render(<CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      expect(mockGetSettings).not.toHaveBeenCalled();
    });
  });

  describe('Given the modal is open', () => {
    it('When rendered / Then fetches lead stages and custom fields', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
    });

    it('When rendered / Then shows required form fields', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText(/company name/i)).toBeInTheDocument();
        expect(screen.getByText(/first name/i)).toBeInTheDocument();
        expect(screen.getByText(/last name/i)).toBeInTheDocument();
        expect(screen.getByText(/contact email/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then First Name is required and Last Name is optional', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      expect(screen.getByPlaceholderText('e.g. John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Doe')).toBeInTheDocument();
      const firstNameInput = screen.getByPlaceholderText('e.g. John');
      expect(firstNameInput).toHaveAttribute('required');
      expect(firstNameInput).toHaveAttribute('minLength', '2');
      const lastNameInput = screen.getByPlaceholderText('e.g. Doe');
      expect(lastNameInput).not.toHaveAttribute('required');
    });

    it('When rendered / Then always shows Referred By field regardless of source', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText(/referred by/i)).toBeInTheDocument();
        expect(screen.getByTestId('partner-search-dropdown')).toBeInTheDocument();
      });
    });

    it('When Referred By dropdown is opened / Then shows partner options', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('partner-search-dropdown'));
      const dropdown = screen.getByTestId('partner-search-dropdown');
      fireEvent.click(dropdown.querySelector('[role="combobox"]')!);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('Beta LLC')).toBeInTheDocument();
      });
    });

    it('When settings load / Then shows lead stage options from settings', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('Contacted')).toBeInTheDocument();
      });
    });

    it('When settings load / Then shows custom field labels', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText('Industry')).toBeInTheDocument();
        expect(screen.getByText(/budget/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given a duplicate company name is entered', () => {
    it('When company name matches an existing lead / Then shows duplicate warning', async () => {
      render(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme Corp']} />,
      );
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Acme Corp' } });
      expect(screen.getByText(/potential duplicate/i)).toBeInTheDocument();
    });

    it('When company name does not match / Then does not show duplicate warning', async () => {
      render(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme Corp']} />,
      );
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'New Company' } });
      expect(screen.queryByText(/potential duplicate/i)).not.toBeInTheDocument();
    });
  });

  describe('Given the form is filled and submitted', () => {
    it('When submitted successfully / Then calls onSuccess and onClose', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      render(<CreateLeadModal isOpen={true} onClose={onClose} onSuccess={onSuccess} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateLead).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('When submitted / Then passes first_name and last_name (not contact_name) to createLead', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Doe'), { target: { value: 'Smith' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateLead.mock.calls[0][0];
        expect(payload.first_name).toBe('Alice');
        expect(payload.last_name).toBe('Smith');
        expect(payload).not.toHaveProperty('contact_name');
      });
    });

    it('When submitted with valid phone / Then phone is trimmed before saving', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '  +91 9876543210  ' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateLead.mock.calls[0][0];
        expect(payload.phone).toBe('+91 9876543210');
      });
    });

    it('When submission fails / Then shows error message', async () => {
      mockCreateLead.mockRejectedValue(new Error('Server error'));
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(screen.getByText(/failed to create lead/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given the Primary Mobile Number mandatory validation', () => {
    it('When phone label is rendered / Then shows required asterisk (*)', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      expect(screen.getAllByText('*').length).toBeGreaterThan(0);
    });

    it('When form is submitted with empty phone / Then shows required error and does not call createLead', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(screen.getByText('Primary Mobile Number is required.')).toBeInTheDocument();
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When form is submitted with whitespace-only phone / Then shows required error', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '   ' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(screen.getByText('Primary Mobile Number is required.')).toBeInTheDocument();
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When form is submitted with invalid phone format / Then shows format error', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: 'abc' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(screen.getByText(/7.*20 digits/i)).toBeInTheDocument();
      expect(mockCreateLead).not.toHaveBeenCalled();
    });

    it('When phone is typed with invalid format / Then shows inline format error immediately', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: 'bad!!phone' } });
      expect(screen.getByText(/7.*20 digits/i)).toBeInTheDocument();
    });

    it('When phone field is cleared after an error / Then clears the inline error', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: 'bad' } });
      expect(screen.getByText(/7.*20 digits/i)).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '' } });
      expect(screen.queryByText(/7.*20 digits/i)).not.toBeInTheDocument();
    });

    it('When a valid phone is entered / Then no format error is shown', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      expect(screen.queryByText(/Primary Mobile Number is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/7.*20 digits/i)).not.toBeInTheDocument();
    });

    it('When alt phone is not filled / Then form can still submit with only primary phone', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockCreateLead).toHaveBeenCalled());
      const payload = mockCreateLead.mock.calls[0][0];
      expect(payload.alt_phone).toBe('');
    });
  });
});
