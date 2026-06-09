import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockValidateTaxId = vi.fn();
const mockUpdateCreditLimit = vi.fn();
const mockGetBusinessProfile = vi.fn();
const mockUpdateBusinessProfile = vi.fn();
const mockGetCustomerInvoices = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    validateCustomerTaxId: (...a: any[]) => mockValidateTaxId(...a),
    updateCustomerCreditLimit: (...a: any[]) => mockUpdateCreditLimit(...a),
    getCustomerBusinessProfile: (...a: any[]) => mockGetBusinessProfile(...a),
    updateCustomerBusinessProfile: (...a: any[]) => mockUpdateBusinessProfile(...a),
    getCustomerInvoices: (...a: any[]) => mockGetCustomerInvoices(...a),
  },
}));

const shellCtl = vi.hoisted(() => ({ signEnabled: false }));
vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ isModuleEnabled: (m: string) => m === 'sign' && shellCtl.signEnabled }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

import CustomerDetailsPanel from './CustomerDetailsPanel';

const baseLead = {
  id: 'lead-1',
  customer_category: 'b2b',
  tax_id: '',
  tax_id_verified: false,
  credit_limit: 0,
  channel: 'storefront_web',
  acquisition_source: 'storefront_registration',
  referred_by: undefined as string | undefined,
};

const mockPartners = [
  { id: 'p1', company_name: 'Acme Corp', contact_name: 'John' },
  { id: 'p2', company_name: 'Beta LLC' },
];

beforeEach(() => {
  vi.clearAllMocks();
  shellCtl.signEnabled = false;
  mockValidateTaxId.mockResolvedValue({ ...baseLead, tax_id: 'TAX123', tax_id_verified: true });
  mockUpdateCreditLimit.mockResolvedValue({ ...baseLead, credit_limit: 5000 });
  mockGetBusinessProfile.mockResolvedValue(null);
  mockUpdateBusinessProfile.mockResolvedValue({});
  mockGetCustomerInvoices.mockResolvedValue([]);
});

describe('CustomerDetailsPanel', () => {
  describe('Given a B2B customer', () => {
    it('When rendered / Then shows B2B category badge', () => {
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      expect(screen.getByText('B2B')).toBeInTheDocument();
    });

    it('When rendered / Then shows the acquisition source label', () => {
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      expect(screen.getByText('Storefront Registration')).toBeInTheDocument();
    });
  });

  describe('Given referred_by data', () => {
    it('When customer has a referred_by / Then shows Referred By row with partner name', () => {
      const lead = { ...baseLead, referred_by: 'p1' };
      render(<CustomerDetailsPanel lead={lead} onUpdate={vi.fn()} showToast={vi.fn()} partners={mockPartners} />);
      expect(screen.getByText('Referred By')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('When customer has no referred_by / Then does not show Referred By row', () => {
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} partners={mockPartners} />);
      expect(screen.queryByText('Referred By')).not.toBeInTheDocument();
    });

    it('When referred_by id has no matching partner / Then shows the raw id as fallback', () => {
      const lead = { ...baseLead, referred_by: 'unknown-id' };
      render(<CustomerDetailsPanel lead={lead} onUpdate={vi.fn()} showToast={vi.fn()} partners={mockPartners} />);
      expect(screen.getByText('unknown-id')).toBeInTheDocument();
    });

    it('When no partners prop is passed / Then falls back to showing raw referred_by id', () => {
      const lead = { ...baseLead, referred_by: 'p1' };
      render(<CustomerDetailsPanel lead={lead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      expect(screen.getByText('p1')).toBeInTheDocument();
    });
  });

  describe('Given a B2C customer', () => {
    it('When rendered / Then shows B2C category badge', () => {
      const lead = { ...baseLead, customer_category: 'b2c' };
      render(<CustomerDetailsPanel lead={lead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      expect(screen.getByText('B2C')).toBeInTheDocument();
    });
  });

  describe('Given the tax ID field', () => {
    it('When a tax ID is entered and Validate is clicked / Then calls validateCustomerTaxId', async () => {
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText(/29ABCDE/i), { target: { value: 'TAX123' } });
      fireEvent.click(screen.getByRole('button', { name: /validate/i }));
      await waitFor(() => {
        expect(mockValidateTaxId).toHaveBeenCalledWith('lead-1', 'TAX123');
      });
    });

    it('When validation succeeds / Then calls onUpdate and shows success toast', async () => {
      const onUpdate = vi.fn();
      const showToast = vi.fn();
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={onUpdate} showToast={showToast} />);
      fireEvent.change(screen.getByPlaceholderText(/29ABCDE/i), { target: { value: 'TAX123' } });
      fireEvent.click(screen.getByRole('button', { name: /validate/i }));
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith('Tax ID validated successfully', 'success');
      });
    });

    it('When validation fails / Then shows error toast with the error message', async () => {
      mockValidateTaxId.mockRejectedValue({ message: 'Invalid GST number' });
      const showToast = vi.fn();
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={showToast} />);
      fireEvent.change(screen.getByPlaceholderText(/29ABCDE/i), { target: { value: 'BAD' } });
      fireEvent.click(screen.getByRole('button', { name: /validate/i }));
      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Invalid GST number', 'error');
      });
    });
  });

  describe('Given the credit limit field', () => {
    it('When a new limit is entered and saved / Then calls updateCustomerCreditLimit', async () => {
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      const inputs = screen.getAllByRole('spinbutton');
      const creditInput = inputs.find((i) => (i as HTMLInputElement).value === '0') || inputs[0];
      fireEvent.change(creditInput, { target: { value: '5000' } });
      fireEvent.click(screen.getByRole('button', { name: /save|update/i }));
      await waitFor(() => {
        expect(mockUpdateCreditLimit).toHaveBeenCalledWith('lead-1', 5000);
      });
    });

    it('When credit limit update succeeds / Then shows success toast', async () => {
      const showToast = vi.fn();
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={showToast} />);
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '1000' } });
      fireEvent.click(screen.getByRole('button', { name: /save|update/i }));
      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Credit limit updated', 'success');
      });
    });
  });

  describe('Given the Sign module gating', () => {
    it('When the Sign module is disabled / Then the Request Signature button is hidden', () => {
      shellCtl.signEnabled = false;
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /request signature/i })).not.toBeInTheDocument();
    });

    it('When the Sign module is enabled / Then the Request Signature button is shown', () => {
      shellCtl.signEnabled = true;
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      expect(screen.getByRole('button', { name: /request signature/i })).toBeInTheDocument();
    });
  });

  describe('Given the Invoices section', () => {
    it('When the customer has a core_partner_id / Then invoices are fetched by that partner id', async () => {
      const lead = { ...baseLead, core_partner_id: 'partner-9' };
      render(<CustomerDetailsPanel lead={lead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      await waitFor(() => {
        expect(mockGetCustomerInvoices).toHaveBeenCalledWith('partner-9');
      });
    });

    it('When no core_partner_id is set / Then it falls back to the lead id', async () => {
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      await waitFor(() => {
        expect(mockGetCustomerInvoices).toHaveBeenCalledWith('lead-1');
      });
    });

    it('When invoices exist / Then shows count, total purchase value, and recent invoice numbers', async () => {
      mockGetCustomerInvoices.mockResolvedValue([
        { id: 'inv-1', invoice_number: 'INV-0001', total_amount: 1000, status: 'paid', issue_date: '2026-05-01' },
        { id: 'inv-2', invoice_number: 'INV-0002', total_amount: 500, status: 'sent', issue_date: '2026-05-10' },
      ]);
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Invoice Count')).toBeInTheDocument();
      });
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('INV-0001')).toBeInTheDocument();
      expect(screen.getByText('INV-0002')).toBeInTheDocument();
    });

    it('When no invoices exist / Then shows the empty state', async () => {
      mockGetCustomerInvoices.mockResolvedValue([]);
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('No invoices for this customer yet.')).toBeInTheDocument();
      });
    });

    it('When the invoice fetch fails / Then it renders without crashing (fail-soft empty state)', async () => {
      mockGetCustomerInvoices.mockRejectedValue(new Error('accounting down'));
      render(<CustomerDetailsPanel lead={baseLead} onUpdate={vi.fn()} showToast={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('No invoices for this customer yet.')).toBeInTheDocument();
      });
    });
  });
});
