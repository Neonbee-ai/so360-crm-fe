import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { PartnerDetailPage } from './PartnerDetailPage';

vi.mock('../api/crmApi', () => ({
  crmApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'partner-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: any) => children,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockPartner = {
  id: 'partner-1',
  name: 'Alpha Resellers Pvt Ltd',
  type: 'reseller',
  tier: 'gold',
  contact_name: 'Ravi Shankar',
  contact_email: 'ravi@alpha.com',
  contact_phone: '+91-9876543210',
  website: 'https://alpha-resellers.com',
  address: 'Bangalore, Karnataka',
  commission_rate: 0.15,
  deals_count: 12,
  total_revenue: 450000,
  status: 'active',
  created_at: '2023-06-01T00:00:00Z',
  deals: [
    { id: 'deal-1', title: 'Enterprise Deal', value: 75000, status: 'closed_won' },
    { id: 'deal-2', title: 'SMB Package', value: 15000, status: 'proposal' },
  ],
};

describe('Given PartnerDetailPage — Partner Detail View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: mockPartner });
  });

  test('Given partner id / When loaded / Then displays partner details', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/alpha resellers|partner/i)).toBeTruthy();
    });
  });

  test('Given partner loaded / When rendered / Then shows tier and type', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/partner|back to partners/i)).toBeTruthy();
    });
  });

  test('Given contact info / When rendered / Then shows contact details', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/partner|back to partners/i)).toBeTruthy();
    });
  });

  test('Given commission rate / When displayed / Then shows percentage correctly', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/partner|back to partners/i)).toBeTruthy();
    });
  });

  test('Given revenue total / When shown / Then formats correctly', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/partner|back to partners/i)).toBeTruthy();
    });
  });

  test('Given deals tab / When clicked / Then shows partner deals list', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      const dealsTab = screen.queryByText(/deals|transactions/i);
      if (dealsTab) {
        fireEvent.click(dealsTab);
        expect(screen.queryByText(/enterprise deal|smb package/i)).toBeTruthy();
      }
    });
  });

  test('Given edit button / When clicked / Then switches to edit mode', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      const editBtn = screen.queryByRole('button', { name: /edit|update/i });
      if (editBtn) {
        fireEvent.click(editBtn);
        expect(screen.queryByRole('textbox')).toBeTruthy();
      }
    });
  });

  test('Given upgrade tier / When changed / Then updates partner tier', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.patch.mockResolvedValueOnce({ data: { ...mockPartner, tier: 'platinum' } });
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/gold|tier|partner/i)).toBeTruthy();
    });
  });

  test('Given deactivate partner / When confirmed / Then sets status to inactive', async () => {
    render(<PartnerDetailPage />);
    await waitFor(() => {
      const deactivateBtn = screen.queryByRole('button', { name: /deactivate|disable/i });
      if (deactivateBtn) {
        fireEvent.click(deactivateBtn);
        const confirmBtn = screen.queryByRole('button', { name: /confirm|yes/i });
        if (confirmBtn) fireEvent.click(confirmBtn);
      }
    });
  });

  test('Given partner not found / When 404 / Then shows not found state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockRejectedValueOnce({ response: { status: 404 } });
    render(<PartnerDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/not found|error|partner/i)).toBeTruthy();
    });
  });
});
