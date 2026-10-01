import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Data Layer Class B on Create Lead (crm.lead, create.section slot), behind
 * submodule:data_layer:custom_fields. Save path: createLead still sends legacy
 * custom_fields as meta_data; Class B values go through the native
 * PATCH /leads/:id ({ custom_fields }) right after the create.
 */

const dl = vi.hoisted(() => ({
  flag: false,
  regs: [] as any[],
  fields: [] as any[],
  layouts: {} as Record<string, any>,
}));

function ProbeSection(props: any) {
  return (
    <div data-testid={`section-${props.registration.id}`} data-entity={props.datasetCode} data-mode={props.mode} data-save-mode={props.saveMode}>
      <button type="button" onClick={() => props.onValuesChange({ ...props.values, plate: 'KL-01' })}>fill-plate</button>
    </div>
  );
}

const mockCreateLead = vi.fn();
const mockLeadUpdate = vi.fn();

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) => (isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null),
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: () => Promise.resolve({ lead_stages: [{ id: 'ls1', name: 'New' }], lead_custom_fields: [], default_owner_id: 'u1' }),
    createLead: (...a: any[]) => mockCreateLead(...a),
    getUsers: () => Promise.resolve([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]),
    getPartners: () => Promise.resolve([]),
  },
  settingsApi: { sourceTypes: { getAll: () => Promise.resolve([]) } },
  leadsApi: { update: (...a: any[]) => mockLeadUpdate(...a) },
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: () => Promise.resolve() }),
  useIdentity: () => ({ user: { id: 'u1', full_name: 'Test User', email: 't@t.com' } }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true, isAdmin: false, isFeatureHidden: () => false,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useDatasetSchema: () => ({ fields: dl.fields }),
  useSlotRenderers: (code: string, slot: string) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: ProbeSection, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

import { CreateLeadModal } from './CreateLeadModal';

const SECTION = { id: 'cs1', dataset_code: 'crm.lead', slot: 'create.section', renderer: 'custom_fields' };

const fillNative = async () => {
  await waitFor(() => screen.getByTestId('modal'));
  fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Acme Corp' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. John'), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'alice@acme.com' } });
  fireEvent.change(screen.getByPlaceholderText('+91 98765 43210'), { target: { value: '+91 9876543210' } });
};

const createButton = () => screen.getByRole('button', { name: /create lead/i });

const renderModal = (onClose = vi.fn(), onSuccess = vi.fn()) =>
  render(<CreateLeadModal isOpen={true} onClose={onClose} onSuccess={onSuccess} existingLeads={[]} />);

beforeEach(() => {
  vi.clearAllMocks();
  dl.flag = false;
  dl.regs = [SECTION];
  dl.fields = [{ field_key: 'plate', label: 'Plate', field_type: 'text', required: false }];
  dl.layouts = {};
  mockCreateLead.mockResolvedValue({ id: 'l-new', company_name: 'Acme Corp' });
  mockLeadUpdate.mockResolvedValue({ id: 'l-new' });
});

describe('Feature: Required Class B validation on Create Lead submit', () => {
  describe('Scenario: the form is submitted while required Class B fields are empty', () => {
    it('then the missing field labels are listed and nothing is created', async () => {
      // Given the flag is on with two required Class B fields and one optional
      dl.flag = true;
      dl.fields = [
        { field_key: 'plate', label: 'Plate', field_type: 'text', required: true },
        { field_key: 'vin', label: 'VIN', field_type: 'text', required: true },
        { field_key: 'colour', label: 'Colour', field_type: 'text', required: false },
      ];
      renderModal();
      await fillNative();
      await screen.findByTestId('section-cs1');
      // When the form is submitted directly (bypassing the disabled button)
      fireEvent.submit(document.querySelector('form')!);
      // Then
      await screen.findByText('Please fill in: Plate, VIN');
      expect(mockCreateLead).not.toHaveBeenCalled();
      expect(mockLeadUpdate).not.toHaveBeenCalled();
    });
  });
});
