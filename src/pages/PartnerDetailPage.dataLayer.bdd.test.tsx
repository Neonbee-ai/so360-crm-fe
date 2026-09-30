import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
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

describe('Given the data-layer flag is OFF', () => {
  it('When renderers are registered / Then the partner page renders no slot regions, wrapper or injected tabs', async () => {
    dl.regs = [reg({}), reg({ id: 'r2', slot: 'detail.sidebar' }), reg({ id: 'r3', slot: 'detail.tab', label: 'KYC' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
    expect(container.querySelector('[data-dl-tab]')).toBeNull();
    expect(dl.layouts['core.partner']).toBeUndefined();
    expect(screen.getByText('Partner Information')).toBeInTheDocument();
  });
});

describe('Given the data-layer flag is ON', () => {
  beforeEach(() => { dl.flag = true; });

  it('When the page loads / Then the core.partner record layout is registered with a History tab', async () => {
    await renderLoaded();
    await waitFor(() => expect(dl.layouts['core.partner']).toBeTruthy());
    expect(dl.layouts['core.partner'].tabOrder).toContain('history');
  });

  it('When nothing is registered / Then the page renders without any data-layer DOM', async () => {
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
  });

  it('When section, sidebar and actions renderers exist / Then each region carries core.partner + record context', async () => {
    dl.regs = [reg({ id: 'sec' }), reg({ id: 'side', slot: 'detail.sidebar' }), reg({ id: 'act', slot: 'detail.actions' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-record-layout="core.partner"]')?.getAttribute('data-record-id')).toBe('partner-1');
    for (const [slot, region, id] of [['detail.section', 'main', 'sec'], ['detail.sidebar', 'sidebar', 'side'], ['detail.actions', 'actions', 'act']]) {
      const el = container.querySelector(`[data-dl-slot="${slot}"]`)!;
      expect(el.getAttribute('data-region')).toBe(region);
      expect(el.getAttribute('data-dl-entity')).toBe('core.partner');
      expect(el.getAttribute('data-dl-record-id')).toBe('partner-1');
      const probe = screen.getByTestId(`probe-${id}`);
      expect(probe.getAttribute('data-entity')).toBe('core.partner');
      expect(probe.getAttribute('data-record-id')).toBe('partner-1');
      expect(probe.getAttribute('data-version')).toBe('2026-09-30T08:00:00Z');
      expect(probe.getAttribute('data-save-mode')).toBe('native');
      expect(probe.getAttribute('data-can-edit')).toBe('true');
    }
  });

  it('When a registration targets another entity / Then it is ignored on the partner page', async () => {
    dl.regs = [reg({ id: 'deal-only', dataset_code: 'crm.deal' })];
    const { container } = await renderLoaded();
    expect(screen.queryByTestId('probe-deal-only')).toBeNull();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
  });

  it('When a detail.tab renderer exists / Then an injected tab appears and renders it on click', async () => {
    dl.regs = [reg({ id: 'kyc', slot: 'detail.tab', label: 'KYC' })];
    const { container } = await renderLoaded();
    const btn = container.querySelector('[data-dl-tab="dl:kyc"]') as HTMLElement;
    expect(btn.textContent).toBe('KYC');
    expect(screen.queryByTestId('probe-kyc')).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe-kyc').getAttribute('data-record-id')).toBe('partner-1'));
    expect(screen.queryByText('Partner Information')).toBeNull();
  });

  it('When registrations are hidden or admin-only and the user is not admin / Then neither is rendered', async () => {
    dl.regs = [reg({ id: 'shown' }), reg({ id: 'secret', visibility_profile: 'hidden' }), reg({ id: 'adm', visibility_profile: 'admin' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-shown')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
    expect(screen.queryByTestId('probe-adm')).toBeNull();
  });

  it('When the user is admin / Then admin-only renderers show but hidden ones still do not', async () => {
    dl.isAdmin = true;
    dl.regs = [reg({ id: 'secret', visibility_profile: 'hidden' }), reg({ id: 'adm', visibility_profile: 'admin' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-adm')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
  });

  it('When a renderer saves / Then the module PATCHes /partners/:id with merged custom_fields and the page reflects it', async () => {
    mockPartnersUpdate.mockResolvedValueOnce({ ...partner, custom_fields: { region: 'south', tier: 'gold' } });
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    fireEvent.click(screen.getByText('save-sec'));
    await waitFor(() => expect(mockPartnersUpdate).toHaveBeenCalledWith('partner-1', { custom_fields: { region: 'south', tier: 'gold' } }));
    await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('gold'));
  });
});
