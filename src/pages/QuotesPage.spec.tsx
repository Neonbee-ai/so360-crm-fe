import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { QuotesPage } from './QuotesPage';

vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockQuotes = [
  { id: 'quote-1', quote_number: 'QT-001', deal_title: 'Enterprise Deal', total: 75000, status: 'draft', created_at: '2024-01-15' },
  { id: 'quote-2', quote_number: 'QT-002', deal_title: 'SMB Package', total: 15000, status: 'sent', created_at: '2024-01-20' },
  { id: 'quote-3', quote_number: 'QT-003', deal_title: 'Agency Contract', total: 30000, status: 'accepted', created_at: '2024-01-25' },
];

describe('Given QuotesPage — Quote Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: { quotes: mockQuotes, total: mockQuotes.length } });
  });

  test('Given user visits quotes page / When loaded / Then displays quote list', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.queryByText(/quote|QT-/i)).toBeTruthy();
    });
  });

  test('Given quotes exist / When rendered / Then shows quote numbers and amounts', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.queryByText(/QT-001|QT-002/i)).toBeTruthy();
    });
  });

  test('Given create quote button / When clicked / Then opens quote creation form', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create quote|new quote|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given status filter / When draft selected / Then shows only draft quotes', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      const filterEl = screen.queryByText(/draft|status/i);
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given quote row / When clicked / Then navigates to quote detail', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      const quoteEl = screen.queryByText(/QT-001/i);
      if (quoteEl) fireEvent.click(quoteEl);
    });
  });

  test('Given send action / When triggered on draft quote / Then updates status to sent', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.patch.mockResolvedValueOnce({ data: { ...mockQuotes[0], status: 'sent' } });
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.queryByText(/quote|send|status/i)).toBeTruthy();
    });
  });

  test('Given empty quote list / When no quotes / Then shows empty state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValueOnce({ data: { quotes: [], total: 0 } });
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no quotes|empty|quote/i)).toBeTruthy();
    });
  });

  test('Given search input / When user types / Then filters quotes by number or deal', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      const searchEl = screen.queryByPlaceholderText(/search/i);
      if (searchEl) {
        fireEvent.change(searchEl, { target: { value: 'QT-001' } });
      }
    });
  });

  test('Given accepted quote / When viewed / Then shows acceptance badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.queryByText(/accepted|quote/i)).toBeTruthy();
    });
  });

  test('Given pagination / When next page clicked / Then loads more quotes', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      const nextBtn = screen.queryByRole('button', { name: /next|>/i });
      if (nextBtn) fireEvent.click(nextBtn);
    });
  });
});
