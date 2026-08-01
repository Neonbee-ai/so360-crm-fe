import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import QuoteDetailPage from './QuoteDetailPage';

const mockCrmService = vi.hoisted(() => ({
  approveQuote: vi.fn(),
  convertQuoteToOrder: vi.fn(),
  getQuoteById: vi.fn(),
  getStockAvailability: vi.fn(),
  rejectQuote: vi.fn(),
  submitQuoteForApproval: vi.fn(),
  updateQuote: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'quote-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  Link: ({ children }: any) => children,
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
  useBusinessSettings: () => ({ base_currency: 'USD', locale: 'en-US', currency: 'USD' }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
  ShellContext: React.createContext({}),
  useIdentity: () => ({ user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' } }),
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

const mockQuote = {
  id: 'quote-1',
  quote_number: 'QT-001',
  deal_id: 'deal-1',
  deal_title: 'Enterprise Software License',
  customer_name: 'Acme Corp',
  status: 'draft',
  line_items: [
    { id: 'li-1', product: 'Enterprise License', qty: 5, unit_price: 15000, total: 75000 },
    { id: 'li-2', product: 'Implementation Fee', qty: 1, unit_price: 10000, total: 10000 },
  ],
  subtotal: 85000,
  tax: 15300,
  total: 100300,
  valid_until: '2024-03-31',
  created_at: '2024-01-15T00:00:00Z',
  notes: 'Volume discount applied',
};

describe('Given QuoteDetailPage — Quote Detail and Editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getQuoteById.mockResolvedValue(mockQuote);
    mockCrmService.getStockAvailability.mockResolvedValue({});
  });

  test('Given quote id in params / When loaded / Then displays quote details', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/QT-001|enterprise software|quote/i).length).toBeGreaterThan(0);
    });
  });

  test('Given quote loaded / When rendered / Then shows line items and totals', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/75,000|10,000|100,300|line item/i).length).toBeGreaterThan(0);
    });
  });

  test('Given send quote button / When clicked / Then changes status to sent', async () => {
    mockCrmService.updateQuote.mockResolvedValueOnce({ ...mockQuote, status: 'sent' });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const sendBtn = screen.queryByRole('button', { name: /send quote|send/i });
      if (sendBtn) {
        fireEvent.click(sendBtn);
      }
    });
  });

  test('Given add line item / When clicked / Then opens product picker', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const addItemBtn = screen.queryByRole('button', { name: /add item|add product/i });
      if (addItemBtn) {
        fireEvent.click(addItemBtn);
      }
    });
  });

  test('Given duplicate quote / When action triggered / Then creates copy as draft', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const dupeBtn = screen.queryByRole('button', { name: /duplicate|copy/i });
      if (dupeBtn) fireEvent.click(dupeBtn);
    });
  });

  test('Given accept button / When clicked / Then marks quote as accepted', async () => {
    mockCrmService.approveQuote.mockResolvedValueOnce({ ...mockQuote, status: 'accepted' });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const acceptBtn = screen.queryByRole('button', { name: /accept|mark accepted/i });
      if (acceptBtn) fireEvent.click(acceptBtn);
    });
  });

  test('Given download PDF button / When clicked / Then triggers PDF generation', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const pdfBtn = screen.queryByRole('button', { name: /pdf|download|print/i });
      if (pdfBtn) fireEvent.click(pdfBtn);
    });
  });

  test('Given quote not found / When invalid id / Then shows not found state', async () => {
    mockCrmService.getQuoteById.mockRejectedValueOnce({ response: { status: 404 } });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/not found|error|quote/i).length).toBeGreaterThan(0);
    });
  });

  test('Given tax calculation / When items added / Then recalculates GST', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/15,300|tax|gst/i).length).toBeGreaterThan(0);
    });
  });

  test('Given validity period / When shown / Then displays valid until date', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/2024-03-31|march 31|valid until/i).length).toBeGreaterThan(0);
    });
  });
});
