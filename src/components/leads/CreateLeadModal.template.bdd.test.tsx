import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateLead = vi.fn();
const mockRecordActivity = vi.fn();

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
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useIdentity: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: (k: string) => k !== 'submodule:crm:dl_custom_fields', isFeatureHidden: () => false }),

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

describe('CreateLeadModal — FormPageTemplate slots', () => {
  describe('Given the form is open', () => {
    it('When it renders / Then titled sections appear in order Contact, Address, Assignment', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      const page = await screen.findByTestId('create-lead-form-page');
      const titles = Array.from(page.querySelectorAll('[data-slot="section"] > h2')).map((h) => h.textContent);
      expect(titles.slice(0, 3)).toEqual(['Contact', 'Address', 'Assignment']);
    });

    it('When it renders / Then the footer order is Cancel then the primary Create Lead (Create last)', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('create-lead-form-page'));
      const buttons = Array.from(document.querySelectorAll('[data-slot="footer"] button')).map((b) => b.textContent);
      expect(buttons).toEqual(['Cancel', 'Create Lead']);
    });

    it('When required fields are empty / Then the primary is disabled, not hidden', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => screen.getByTestId('create-lead-form-page'));
      expect(screen.getByRole('button', { name: 'Create Lead' })).toBeDisabled();
    });
  });
});
