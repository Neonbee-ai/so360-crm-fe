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
  },
}));

vi.mock('@so360/shell-context', () => ({
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
}));

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
        expect(screen.getByText(/contact name/i)).toBeInTheDocument();
        expect(screen.getByText(/contact email/i)).toBeInTheDocument();
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
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateLead).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('When submission fails / Then shows error message', async () => {
      mockCreateLead.mockRejectedValue(new Error('Server error'));
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(screen.getByText(/failed to create lead/i)).toBeInTheDocument();
      });
    });
  });
});
