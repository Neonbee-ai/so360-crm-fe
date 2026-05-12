import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    validateCustomerTaxId: vi.fn().mockResolvedValue({ tax_id: 'TAX123', tax_id_verified: true }),
    updateCustomerCreditLimit: vi.fn().mockResolvedValue({ credit_limit: 5000 }),
  },
}));

import CustomerDetailsPanel from './CustomerDetailsPanel';
import { crmService } from '../services/crmService';

beforeEach(() => { vi.clearAllMocks(); });

describe('CustomerDetailsPanel', () => {
  const defaultProps = {
    lead: {
      id: 'lead-1',
      customer_category: 'b2b',
      tax_id: '',
      tax_id_verified: false,
      credit_limit: 0,
      channel: 'storefront_web',
      acquisition_source: 'storefront_registration',
    },
    onUpdate: vi.fn(),
    showToast: vi.fn(),
  };

  it('renders B2B panel with category', () => {
    render(<CustomerDetailsPanel {...defaultProps} />);
    expect(screen.getByText('B2B')).toBeInTheDocument();
  });

  it('renders acquisition source label', () => {
    render(<CustomerDetailsPanel {...defaultProps} />);
    expect(screen.getByText('Storefront Registration')).toBeInTheDocument();
  });

  it('renders B2C category when not b2b', () => {
    render(<CustomerDetailsPanel {...defaultProps} lead={{ ...defaultProps.lead, customer_category: 'b2c' }} />);
    expect(screen.getByText('B2C')).toBeInTheDocument();
  });

  it('validates tax ID on button click', async () => {
    render(<CustomerDetailsPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(/29ABCDE/i);
    fireEvent.change(input, { target: { value: 'TAX123' } });
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateBtn);
    await waitFor(() => {
      expect(crmService.validateCustomerTaxId).toHaveBeenCalledWith('lead-1', 'TAX123');
    });
  });

  it('handles tax validation error', async () => {
    vi.mocked(crmService.validateCustomerTaxId).mockRejectedValueOnce(new Error('Invalid tax ID'));
    render(<CustomerDetailsPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(/29ABCDE/i);
    fireEvent.change(input, { target: { value: 'BAD' } });
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateBtn);
    await waitFor(() => {
      expect(defaultProps.showToast).toHaveBeenCalledWith('Invalid tax ID', 'error');
    });
  });

  it('saves credit limit', async () => {
    render(<CustomerDetailsPanel {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    const creditInput = inputs.find(i => (i as HTMLInputElement).value === '0') || inputs[0];
    if (creditInput) {
      fireEvent.change(creditInput, { target: { value: '5000' } });
      const saveBtn = screen.getByRole('button', { name: /save|update/i });
      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(crmService.updateCustomerCreditLimit).toHaveBeenCalledWith('lead-1', 5000);
      });
    }
  });
});
