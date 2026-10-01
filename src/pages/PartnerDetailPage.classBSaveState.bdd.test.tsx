import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Edge cases for the Class B onSaved state merge on this page.
 * Data Layer Class B on Partner Detail (core.partner).
 * Shell renderers are hosted in named regions behind
 * submodule:data_layer:custom_fields. Values are saved by the module through
 * the native PATCH /partners/:id (partnersApi.update) with merged custom_fields.
 */

const dl = vi.hoisted(() => ({
  flag: false,
  isAdmin: false,
  regs: [] as any[],
  layouts: {} as Record<string, any>,
}));

// Capture the page's Class B onSaved callback and the record it hands the
// data layer on every render, while keeping the real hook behaviour.
const cap = vi.hoisted(() => ({ onSaved: null as any, record: undefined as any }));
vi.mock('../dataLayer/useCrmRecordContext', async (orig) => {
  const real = await orig<typeof import('../dataLayer/useCrmRecordContext')>();
  return {
    ...real,
    useCrmRecordContext: (...a: any[]) => {
      cap.record = a[2];
      cap.onSaved = a[3]?.onSaved;
      return (real.useCrmRecordContext as any)(...a);
    },
  };
});
import { act as __act } from '@testing-library/react';

function ProbeRenderer(props: any) {
  return (
    <div
      data-testid={`probe-${props.registration.id}`}
      data-entity={props.datasetCode}
      data-record-id={props.recordId}
      data-version={String(props.version)}
      data-can-edit={String(props.canEdit)}
      data-save-mode={props.saveMode}
    >
      <span data-testid={`probe-${props.registration.id}-value`}>{String(props.record?.custom_fields?.tier ?? '')}</span>
      <button type="button" onClick={() => props.onSave({ tier: 'gold' })}>save-{props.registration.id}</button>
    </div>
  );
}

const mockPartnersGetOne = vi.fn();
const mockPartnersUpdate = vi.fn();
const mockPartnersGetDeals = vi.fn();
const mockPartnersGetCommissions = vi.fn();
const mockPartnerTypesGetAll = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();

vi.mock('../services/crmService', () => ({
  partnersApi: {
    getOne: (...a: any[]) => mockPartnersGetOne(...a),
    update: (...a: any[]) => mockPartnersUpdate(...a),
    getDeals: (...a: any[]) => mockPartnersGetDeals(...a),
    getCommissions: (...a: any[]) => mockPartnersGetCommissions(...a),
    updateCommission: vi.fn().mockResolvedValue({}),
  },
  leadsApi: { update: vi.fn() },
  dealsApi: { update: vi.fn() },
  settingsApi: { partnerTypes: { getAll: (...a: any[]) => mockPartnerTypesGetAll(...a) } },
  crmService: {
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'partner-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  NavLink: ({ children }: any) => children,
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isAdmin: dl.isAdmin,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
  }),
  useShell: () => ({ isModuleEnabled: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  ShellContext: React.createContext({}),
  // Shell dataLayer API — registry is driven by `dl`.
  useDatasetSchema: () => ({ fields: [] }),
  useSlotRenderers: (code: string, slot: string) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: ProbeRenderer, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v.toFixed(2)}`,
    formatDate: (d: string) => d,
    formatDateTime: (d: string) => d,
  }),
}));

import PartnerDetailPage from './PartnerDetailPage';

const partner = {
  id: 'partner-1',
  first_name: 'Ravi',
  last_name: 'Shankar',
  contact_name: 'Ravi Shankar',
  company_name: 'Alpha Resellers Pvt Ltd',
  email: 'ravi@alpha.com',
  partner_type: 'reseller',
  grading: 'high',
  commission_rate: 15,
  area_served: [],
  custom_fields: { region: 'south' },
  updated_at: '2026-09-30T08:00:00Z',
};
const reg = (over: any) => ({ id: 'r1', dataset_code: 'core.partner', slot: 'detail.section', renderer: 'custom_fields', ...over });

beforeEach(() => {
  vi.clearAllMocks();
  dl.flag = false;
  dl.isAdmin = false;
  dl.regs = [];
  dl.layouts = {};
  mockPartnersGetOne.mockResolvedValue(partner);
  mockPartnerTypesGetAll.mockResolvedValue([{ value: 'reseller', label: 'Reseller' }]);
  mockGetUsers.mockResolvedValue([]);
  mockGetActivitiesByLeadId.mockResolvedValue([]);
  mockPartnersGetDeals.mockResolvedValue({ summary: {}, deals: [] });
  mockPartnersGetCommissions.mockResolvedValue({ summary: {}, commissions: [] });
});

async function renderLoaded() {
  const utils = render(<PartnerDetailPage />);
  await waitFor(() => expect(screen.getByText('Ravi Shankar')).toBeInTheDocument());
  return utils;
}


describe('Feature: Partner detail Class B save merges into page state', () => {
  beforeEach(() => { dl.flag = true; cap.onSaved = null; cap.record = undefined; });

  describe('Scenario: a save completes before the partner has loaded', () => {
    it('then the state stays empty and the page keeps showing its loading state', async () => {
      // Given the partner fetch never resolves (record state is still null)
      mockPartnersGetOne.mockReturnValue(new Promise(() => {}));
      const { container } = render(<PartnerDetailPage />);
      await waitFor(() => expect(typeof cap.onSaved).toBe('function'));
      expect(cap.record == null).toBe(true);
      // When the Class B onSaved callback fires anyway
      await __act(async () => { cap.onSaved({ plate: 'KL-07' }, { version: 4 }); });
      // Then no record is conjured out of the partial values
      expect(cap.record == null).toBe(true);
      expect(container.querySelector('[data-record-layout]')).toBeNull();
    });
  });

  describe('Scenario: a save completes on a loaded record that has no custom_fields yet', () => {
    it('then custom_fields is created from the saved values and the refresh fields are merged', async () => {
      // Given a loaded partner whose custom_fields is missing
      mockPartnersGetOne.mockResolvedValue({ ...partner, custom_fields: null });
      await renderLoaded();
      await waitFor(() => expect(cap.record?.id).toBeTruthy());
      expect(cap.record.custom_fields == null).toBe(true);
      // When the renderer save reports the new values and a refreshed row version
      await __act(async () => { cap.onSaved({ plate: 'KL-07' }, { version: 9 }); });
      // Then custom_fields holds only the saved values and the version is refreshed
      await waitFor(() => expect(cap.record.custom_fields).toEqual({ plate: 'KL-07' }));
      expect(cap.record.version).toBe(9);
    });
  });
});
