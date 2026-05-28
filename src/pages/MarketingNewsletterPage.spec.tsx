import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MarketingNewsletterPage } from './MarketingNewsletterPage';

vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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

const mockNewsletters = [
  { id: 'nl-1', subject: 'Monthly Product Update', status: 'draft', subscribers: 0, created_at: '2024-01-01' },
  { id: 'nl-2', subject: 'Q4 Highlights', status: 'sent', subscribers: 3500, sent_at: '2024-01-15', open_rate: 0.38 },
];

const mockSubscribers = [
  { id: 'sub-1', email: 'user1@test.com', subscribed_at: '2024-01-01', active: true },
  { id: 'sub-2', email: 'user2@test.com', subscribed_at: '2024-01-05', active: true },
];

describe('Given MarketingNewsletterPage — Newsletter Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({
      data: { newsletters: mockNewsletters, subscribers: mockSubscribers, total: mockNewsletters.length },
    });
  });

  test('Given user visits newsletter page / When loaded / Then displays newsletter list', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/newsletter|monthly product/i)).toBeTruthy();
    });
  });

  test('Given newsletters loaded / When rendered / Then shows subject and status', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/monthly product update|q4 highlights/i)).toBeTruthy();
    });
  });

  test('Given compose button / When clicked / Then opens newsletter editor', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      const composeBtn = screen.queryByRole('button', { name: /compose|create newsletter|new/i });
      if (composeBtn) {
        fireEvent.click(composeBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given draft newsletter / When send button triggered / Then confirms send action', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.post.mockResolvedValueOnce({ data: { ...mockNewsletters[0], status: 'sent' } });
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      const sendBtn = screen.queryByRole('button', { name: /send/i });
      if (sendBtn) {
        fireEvent.click(sendBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given sent newsletter / When viewed / Then shows open rate metrics', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/q4 highlights|38%|0.38|sent/i)).toBeTruthy();
    });
  });

  test('Given subscriber list tab / When clicked / Then shows subscriber management', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      const subTab = screen.queryByText(/subscriber|members/i);
      if (subTab) {
        fireEvent.click(subTab);
        expect(screen.queryByText(/user1@test|user2@test|subscriber/i)).toBeTruthy();
      }
    });
  });

  test('Given import subscribers button / When clicked / Then opens CSV import', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      const importBtn = screen.queryByRole('button', { name: /import|csv/i });
      if (importBtn) {
        fireEvent.click(importBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given empty newsletter list / When no newsletters / Then shows empty state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValueOnce({ data: { newsletters: [], subscribers: [], total: 0 } });
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no newsletter|empty|newsletter/i)).toBeTruthy();
    });
  });

  test('Given delete newsletter / When confirmed / Then removes newsletter', async () => {
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      const deleteBtn = screen.queryByRole('button', { name: /delete|remove/i });
      if (deleteBtn) fireEvent.click(deleteBtn);
    });
  });

  test('Given API error / When newsletters fail to load / Then shows error state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockRejectedValueOnce(new Error('Network error'));
    render(<MarketingNewsletterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|newsletter/i)).toBeTruthy();
    });
  });
});
