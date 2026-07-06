import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import PartnerDetailPage from './PartnerDetailPage';

// ── service mocks ─────────────────────────────────────────────────────────────
const mockPartnersGetOne = vi.fn();
const mockPartnersUpdate = vi.fn();
const mockPartnersGetDeals = vi.fn();
const mockPartnersGetCommissions = vi.fn();
const mockPartnersUpdateCommission = vi.fn();
const mockPartnerTypesGetAll = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();

vi.mock('../services/crmService', () => ({
  partnersApi: {
    getOne: (...args: any[]) => mockPartnersGetOne(...args),
    update: (...args: any[]) => mockPartnersUpdate(...args),
    getDeals: (...args: any[]) => mockPartnersGetDeals(...args),
    getCommissions: (...args: any[]) => mockPartnersGetCommissions(...args),
    updateCommission: (...args: any[]) => mockPartnersUpdateCommission(...args),
  },
  settingsApi: {
    partnerTypes: { getAll: (...args: any[]) => mockPartnerTypesGetAll(...args) },
  },
  crmService: {
    getUsers: (...args: any[]) => mockGetUsers(...args),
    getActivitiesByLeadId: (...args: any[]) => mockGetActivitiesByLeadId(...args),
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
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    effectiveFlagsLoaded: true,
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
  }),
  useBusinessSettings: () => ({
    settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
  }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
  ShellContext: React.createContext({}),
  useIdentity: () => ({ user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' } }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v.toFixed(2)}`,
    formatDate: (d: string) => d,
    formatDateTime: (d: string) => d,
  }),
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    effectiveFlagsLoaded: true,
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockPartner = {
  id: 'partner-1',
  first_name: 'Ravi',
  last_name: 'Shankar',
  contact_name: 'Ravi Shankar',
  company_name: 'Alpha Resellers Pvt Ltd',
  email: 'ravi@alpha.com',
  phone: '+91-9876543210',
  partner_type: 'reseller',
  grading: 'high',
  commission_rate: 15,
  area_served: ['South India'],
  pending_commission: 5000,
  owner_person_id: null,
  poc_primary: null,
  poc_secondary: null,
  customers_connected: null,
  value_of_purchase: null,
  total_purchase_till_date: null,
};

const mockCommissions = {
  summary: { total_earned: 25000, pending: 5000, paid: 20000 },
  commissions: [
    { id: 'c1', deal_id: 'deal-1', deal: { name: 'Enterprise Deal' }, deal_amount: 75000, commission_rate: 15, commission_amount: 11250, status: 'pending', payment_ref: null },
    { id: 'c2', deal_id: 'deal-2', deal: { name: 'SMB Package' }, deal_amount: 15000, commission_rate: 15, commission_amount: 2250, status: 'paid', payment_ref: 'NEFT-001' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPartnersGetOne.mockResolvedValue(mockPartner);
  mockPartnerTypesGetAll.mockResolvedValue([{ value: 'reseller', label: 'Reseller' }]);
  mockGetUsers.mockResolvedValue([]);
  mockGetActivitiesByLeadId.mockResolvedValue([]);
  mockPartnersGetDeals.mockResolvedValue({ summary: { total_count: 0, total_value: 0, won_count: 0, won_value: 0 }, deals: [] });
  mockPartnersGetCommissions.mockResolvedValue(mockCommissions);
  mockPartnersUpdate.mockResolvedValue(mockPartner);
  mockPartnersUpdateCommission.mockResolvedValue({});
});

describe('Given PartnerDetailPage — overview tab', () => {
  test('Given partner id / When loaded / Then displays partner name', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Ravi Shankar')).toBeInTheDocument();
    });
  });

  test('Given partner loaded / When rendered / Then shows Back to Partners link', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Back to Partners')).toBeInTheDocument();
    });
  });

  test('Given partner with royalty rate / When overview rendered / Then shows royalty rate inline chip', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/15% royalty/i)).toBeInTheDocument();
    });
  });

  test('Given overview tab / When rendered / Then "Royalty Rate" label appears in details section', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Royalty Rate')).toBeInTheDocument();
    });
  });

  test('Given partner with no royalty rate / When overview rendered / Then royalty inline chip is absent', async () => {
    mockPartnersGetOne.mockResolvedValue({ ...mockPartner, commission_rate: 0 });
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/royalty/i)).not.toBeInTheDocument();
    });
  });
});

describe('Given PartnerDetailPage — Royalties tab', () => {
  test('Given tabs rendered / When checking tab labels / Then tab button says "Royalties" not "Commissions"', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Commissions' })).not.toBeInTheDocument();
    });
  });

  test('Given Royalties tab / When clicked / Then fetches and shows royalty summary cards', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Royalties' }));
    await waitFor(() => {
      expect(mockPartnersGetCommissions).toHaveBeenCalledWith('partner-1');
      expect(screen.getByText('Total Earned')).toBeInTheDocument();
    });
  });

  test('Given Royalties tab open / When table header rendered / Then shows "Royalty" column not "Commission"', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Royalties' }));
    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /^Royalty$/i })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /^Commission$/i })).not.toBeInTheDocument();
    });
  });

  test('Given Royalties tab / When no royalties exist / Then shows "No royalties yet" empty state', async () => {
    mockPartnersGetCommissions.mockResolvedValue({ summary: { total_earned: 0, pending: 0, paid: 0 }, commissions: [] });
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Royalties' }));
    await waitFor(() => {
      expect(screen.getByText('No royalties yet. Royalties are created automatically when a referred deal is won.')).toBeInTheDocument();
    });
  });

  test('Given pending royalty / When Approve clicked / Then shows "Royalty approved" toast', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Royalties' }));
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => {
      expect(mockPartnersUpdateCommission).toHaveBeenCalledWith('c1', { status: 'approved' });
      expect(screen.getByText('Royalty approved')).toBeInTheDocument();
    });
  });

  test('Given approved royalty / When Mark Paid clicked / Then opens "Mark Royalty as Paid" modal', async () => {
    mockPartnersGetCommissions.mockResolvedValue({
      summary: { total_earned: 0, pending: 0, paid: 0 },
      commissions: [{ id: 'c3', deal_id: 'deal-3', deal: { name: 'Deal 3' }, deal_amount: 10000, commission_rate: 10, commission_amount: 1000, status: 'approved', payment_ref: null }],
    });
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Royalties' }));
    await waitFor(() => expect(screen.getByText('Mark Paid')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Mark Paid'));
    await waitFor(() => {
      expect(screen.getByText('Mark Royalty as Paid')).toBeInTheDocument();
    });
  });

  test('Given Mark Royalty modal / When payment ref submitted / Then shows "Royalty marked as paid" toast', async () => {
    mockPartnersGetCommissions.mockResolvedValue({
      summary: { total_earned: 0, pending: 0, paid: 0 },
      commissions: [{ id: 'c3', deal_id: 'deal-3', deal: { name: 'Deal 3' }, deal_amount: 10000, commission_rate: 10, commission_amount: 1000, status: 'approved', payment_ref: null }],
    });
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Royalties' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Royalties' }));
    await waitFor(() => expect(screen.getByText('Mark Paid')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Mark Paid'));
    await waitFor(() => expect(screen.getByText('Mark Royalty as Paid')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. NEFT-2026-001'), { target: { value: 'NEFT-2026-007' } });
    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('e.g. NEFT-2026-001').closest('form')!);
    });
    await waitFor(() => {
      expect(mockPartnersUpdateCommission).toHaveBeenCalledWith('c3', { status: 'paid', payment_ref: 'NEFT-2026-007' });
      expect(screen.getByText('Royalty marked as paid')).toBeInTheDocument();
    });
  });
});

describe('Given PartnerDetailPage — edit mode', () => {
  test('Given overview tab / When Edit clicked / Then shows "Royalty Rate (%)" label in form', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => {
      expect(screen.getByText('Royalty Rate (%)')).toBeInTheDocument();
    });
  });

  test('Given edit mode / Then no "Commission Rate" label exists', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => {
      expect(screen.queryByText('Commission Rate (%)')).not.toBeInTheDocument();
      expect(screen.queryByText('Commission Rate')).not.toBeInTheDocument();
    });
  });
});

describe('Given PartnerDetailPage — partner not found', () => {
  test('Given partner not found / When 404 / Then shows not found message', async () => {
    mockPartnersGetOne.mockRejectedValue(new Error('Not found'));
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Partner not found.')).toBeInTheDocument();
    });
  });
});

describe('Given PartnerDetailPage — royalty rate display', () => {
  test('Given royalty rate / When displayed in overview / Then shows percentage correctly', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('15%')).toBeInTheDocument();
    });
  });
});
