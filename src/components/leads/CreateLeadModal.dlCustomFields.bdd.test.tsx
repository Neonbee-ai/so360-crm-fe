/**
 * BDD specs for CreateLeadModal Data Layer custom fields (flag submodule:crm:dl_custom_fields).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const flag = vi.hoisted(() => ({ on: true }));
const mockCreateLead = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: () => Promise.resolve({
      lead_stages: [{ id: 'ls1', name: 'New' }],
      lead_custom_fields: [{ id: 'cf1', label: 'Industry', type: 'text', required: false }],
      deal_stages: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
    }),
    createLead: (...a: any[]) => mockCreateLead(...a),
    getUsers: () => Promise.resolve([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]),
    getPartners: () => Promise.resolve([]),
  },
  settingsApi: { sourceTypes: { getAll: () => Promise.resolve([]) } },
}));

vi.mock('@so360/shell-context', () => ({
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useIdentity: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: (k: string) => (k === 'submodule:crm:dl_custom_fields' ? flag.on : true),
    isFeatureHidden: () => false,
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

vi.mock('../customFields/DlCustomFieldsPanel', () => ({
  DL_CUSTOM_FIELDS_FLAG: 'submodule:crm:dl_custom_fields',
  DlCustomFieldsPanel: (p: any) => (
    <button type="button" data-testid="dl-create-panel" onClick={() => p.onValuesChange?.({ budget: 9 })}>
      {p.mode}
    </button>
  ),
}));

import { CreateLeadModal } from './CreateLeadModal';

async function fillAndSubmit() {
  await waitFor(() => screen.getByTestId('create-lead-form-page'));
  fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'NewCo' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  flag.on = true;
  mockCreateLead.mockResolvedValue({ id: 'l-new' });
});

describe('CreateLeadModal data-layer custom fields', () => {
  it('Given the flag is on / Then the create-mode DL panel replaces the legacy defs', async () => {
    render(<CreateLeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => expect(screen.getByTestId('dl-create-panel').textContent).toBe('create'));
    expect(screen.queryByText('Industry')).toBeNull();
  });

  it('Given the flag is on and values entered / When submitted / Then custom_fields is in the create body', async () => {
    render(<CreateLeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await fillAndSubmit();
    fireEvent.click(screen.getByTestId('dl-create-panel'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockCreateLead).toHaveBeenCalled());
    expect(mockCreateLead.mock.calls[0][0].custom_fields).toMatchObject({ budget: 9 });
  });

  it('Given the flag is on and no values / When submitted / Then custom_fields is omitted', async () => {
    render(<CreateLeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await fillAndSubmit();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockCreateLead).toHaveBeenCalled());
    expect(mockCreateLead.mock.calls[0][0]).not.toHaveProperty('custom_fields.budget');
  });

  it('Given the flag is off / Then the legacy defs render and no DL panel', async () => {
    flag.on = false;
    render(<CreateLeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
    await waitFor(() => expect(screen.getByText('Industry')).toBeInTheDocument());
    expect(screen.queryByTestId('dl-create-panel')).toBeNull();
  });
});
