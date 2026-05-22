import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetUsers = vi.fn();
const mockGetSettings = vi.fn();
const mockCreateDeal = vi.fn();
const mockRecordActivity = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
  },
  dealsApi: {
    create: (...a: any[]) => mockCreateDeal(...a),
  },
}));

vi.mock('../../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  usePeople: () => ({ people: [] }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import CreateDealModal from './CreateDealModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsers.mockResolvedValue([
    { id: 'u1', full_name: 'Alice Rep', email: 'alice@test.com' },
    { id: 'u2', full_name: 'Bob Manager', email: 'bob@test.com' },
  ]);
  mockGetSettings.mockResolvedValue({
    deal_stages: [{ id: 's1', name: 'Lead' }, { id: 's2', name: 'Qualified' }],
    lead_stages: [], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
  });
  mockCreateDeal.mockResolvedValue({ id: 'd-new', name: 'Acme Deal' });
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('CreateDealModal', () => {
  const defaultProps = {
    leadId: 'lead-1',
    leadName: 'John Doe',
    companyName: 'Acme',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  describe('Given the modal renders', () => {
    it('When rendered / Then shows the New Deal header', async () => {
      render(<CreateDealModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/new deal/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then pre-fills the deal name with company name', () => {
      render(<CreateDealModal {...defaultProps} />);
      expect(screen.getByDisplayValue('Acme Deal')).toBeInTheDocument();
    });

    it('When dependencies load / Then shows users in the owner dropdown', async () => {
      render(<CreateDealModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Alice Rep')).toBeInTheDocument();
      });
    });
  });

  describe('Given the form is submitted successfully', () => {
    it('When submitted / Then calls dealsApi.create with correct data', async () => {
      render(<CreateDealModal {...defaultProps} />);
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateDeal).toHaveBeenCalledWith(
          expect.objectContaining({ company: 'Acme', lead_id: 'lead-1' }),
        );
      });
    });

    it('When submitted / Then calls onSuccess and onClose', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      render(<CreateDealModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Given the close button is clicked', () => {
    it('When the X button is clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<CreateDealModal {...defaultProps} onClose={onClose} />);
      // The X button from lucide
      const closeButtons = screen.getAllByRole('button');
      fireEvent.click(closeButtons[0]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given a deal value is entered', () => {
    it('When a numeric value is typed / Then includes it in the deal payload', async () => {
      render(<CreateDealModal {...defaultProps} />);
      const valueInput = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (valueInput) {
        fireEvent.change(valueInput, { target: { value: '15000' } });
      }
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateDeal).toHaveBeenCalledWith(
          expect.objectContaining({ value: 15000 }),
        );
      });
    });
  });
});
