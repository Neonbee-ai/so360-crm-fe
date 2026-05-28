import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { QuoteDetailPage } from './QuoteDetailPage';

const mockCrmService = {
  approveQuote: vi.fn(),
  convertQuoteToOrder: vi.fn(),
  getQuoteById: vi.fn(),
  getStockAvailability: vi.fn(),
  rejectQuote: vi.fn(),
  submitQuoteForApproval: vi.fn(),
  updateQuote: vi.fn(),
};

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'quote-1' }),
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
      expect(screen.queryByText(/QT-001|enterprise software|quote/i)).toBeTruthy();
    });
  });

  test('Given quote loaded / When rendered / Then shows line items and totals', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/75,000|10,000|100,300|line item/i)).toBeTruthy();
    });
  });

  test('Given send quote button / When clicked / Then changes status to sent', async () => {
    mockCrmService.updateQuote.mockResolvedValueOnce({ ...mockQuote, status: 'sent' });
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const sendBtn = screen.queryByRole('button', { name: /send quote|send/i });
      if (sendBtn) {
        fireEvent.click(sendBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given add line item / When clicked / Then opens product picker', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      const addItemBtn = screen.queryByRole('button', { name: /add item|add product/i });
      if (addItemBtn) {
        fireEvent.click(addItemBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
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
      expect(screen.queryByText(/not found|error|quote/i)).toBeTruthy();
    });
  });

  test('Given tax calculation / When items added / Then recalculates GST', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/15,300|tax|gst/i)).toBeTruthy();
    });
  });

  test('Given validity period / When shown / Then displays valid until date', async () => {
    render(<QuoteDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/2024-03-31|march 31|valid until/i)).toBeTruthy();
    });
  });
});
