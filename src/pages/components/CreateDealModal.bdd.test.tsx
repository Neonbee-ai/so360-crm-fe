import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetUsers = vi.fn();
const mockGetSettings = vi.fn();
const mockCreateDeal = vi.fn();
const mockRecordActivity = vi.fn();
const mockUseBusinessSettings = vi.fn();
const mockShowError = vi.fn();

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
  useToast: () => ({ toasts: [], showError: (...a: any[]) => mockShowError(...a), dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: (...a: any[]) => mockUseBusinessSettings(...a),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  usePeople: () => ({ people: [] }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

import CreateDealModal from './CreateDealModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockShowError.mockReset();
  mockUseBusinessSettings.mockReturnValue({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } });
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

  describe('Given the value field currency symbol', () => {
    it('When base_currency is USD / Then shows $ text symbol (not a DollarSign SVG icon)', () => {
      render(<CreateDealModal {...defaultProps} />);
      expect(screen.getByText('$')).toBeInTheDocument();
    });

    it('When base_currency is INR / Then shows ₹ symbol instead of $', () => {
      mockUseBusinessSettings.mockReturnValue({ settings: { base_currency: 'INR', document_language: 'en-IN', timezone: 'Asia/Kolkata' } });
      render(<CreateDealModal {...defaultProps} />);
      expect(screen.queryByText('$')).not.toBeInTheDocument();
      const hasInrSymbol = screen.queryByText('₹') !== null || screen.queryByText('INR') !== null;
      expect(hasInrSymbol).toBe(true);
    });

    it('When base_currency is AED / Then shows AED symbol instead of $', () => {
      mockUseBusinessSettings.mockReturnValue({ settings: { base_currency: 'AED', document_language: 'ar-AE', timezone: 'Asia/Dubai' } });
      render(<CreateDealModal {...defaultProps} />);
      expect(screen.queryByText('$')).not.toBeInTheDocument();
      const hasAedSymbol = screen.queryByText('AED') !== null || screen.queryByText('د.إ') !== null;
      expect(hasAedSymbol).toBe(true);
    });

    it('When base_currency is missing / Then falls back to $ symbol', () => {
      mockUseBusinessSettings.mockReturnValue({ settings: null });
      render(<CreateDealModal {...defaultProps} />);
      expect(screen.getByText('$')).toBeInTheDocument();
    });
  });

  describe('Given no company name is provided', () => {
    it('When rendered without companyName / Then deal name field starts empty', () => {
      render(<CreateDealModal leadId="lead-1" leadName="John" onClose={vi.fn()} onSuccess={vi.fn()} />);
      const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      expect(nameInput.value).toBe('');
    });
  });

  describe('Given the API call fails during submit', () => {
    it('When dealsApi.create rejects / Then showError is called with the failure message', async () => {
      mockCreateDeal.mockRejectedValueOnce(new Error('Network error'));
      render(<CreateDealModal {...defaultProps} />);
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to create deal');
      });
    });
  });

  describe('Given optional date and owner fields are filled', () => {
    it('When start date and close date are set / Then they are included in the create payload', async () => {
      render(<CreateDealModal {...defaultProps} />);
      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2025-06-01' } });
      fireEvent.change(dateInputs[1], { target: { value: '2025-09-30' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateDeal).toHaveBeenCalledWith(
          expect.objectContaining({
            start_date: expect.any(String),
            expected_close: expect.any(String),
          }),
        );
      });
    });
  });

  describe('Given no leadId is provided', () => {
    it('When submitted / Then lead_id is undefined in the create payload', async () => {
      render(<CreateDealModal companyName="Acme" onClose={vi.fn()} onSuccess={vi.fn()} />);
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateDeal).toHaveBeenCalledWith(
          expect.objectContaining({ lead_id: undefined }),
        );
      });
    });
  });

  describe('Given modal size constraint', () => {
    it('When rendered / Then modal container has max-h-[90vh] to stay within viewport', () => {
      render(<CreateDealModal {...defaultProps} />);
      const panels = Array.from(document.querySelectorAll('div')).filter(
        el => el.className.includes('max-h-[90vh]'),
      );
      expect(panels.length).toBeGreaterThan(0);
    });
  });

  describe('Given empty deal stages are returned', () => {
    it('When settings has no deal stages / Then stage select renders empty and submit still works', async () => {
      mockGetSettings.mockResolvedValueOnce({
        deal_stages: [],
        lead_stages: [], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
      });
      render(<CreateDealModal {...defaultProps} />);
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateDeal).toHaveBeenCalled();
      });
    });
  });
});
