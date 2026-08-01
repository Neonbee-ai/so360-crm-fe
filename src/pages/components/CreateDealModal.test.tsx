import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: vi.fn().mockResolvedValue([{ id: 'u1', full_name: 'Test', email: 't@t.com' }]),
    getSettings: vi.fn().mockResolvedValue({ deal_stages: [{ id: 's1', name: 'Lead' }], lead_stages: [], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1' }),
  },
  dealsApi: { create: vi.fn().mockResolvedValue({ id: 'd1', name: 'Test Deal' }) },
}));

vi.mock('../../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  usePeople: () => ({ people: [] }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import CreateDealModal from './CreateDealModal';

beforeEach(() => { vi.clearAllMocks(); });

describe('Given CreateDealModal', () => {
  const defaultProps = {
    leadId: 'lead-1',
    leadName: 'John',
    companyName: 'Acme',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it('When action / Then renders the modal with form fields', async () => {
    render(<CreateDealModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/create deal/i)).toBeInTheDocument();
    });
  });

  it('When action / Then pre-fills the deal name from company', () => {
    render(<CreateDealModal {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('Acme Deal');
    expect(nameInput).toBeInTheDocument();
  });
});
