/**
 * BDD specs for MarketingCampaignDetailPage
 *
 * Scenarios covered:
 *  - Loading state
 *  - Missing storeId shows amber prompt
 *  - Campaign header, subject, recipients count
 *  - Recipients table with rows and empty state
 *  - Test Send input and button
 *  - Schedule input and button
 *  - Error state from API
 *  - Back navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mockGetCampaign = vi.fn();
const mockGetCampaignRecipients = vi.fn();
const mockTestSendCampaign = vi.fn();
const mockScheduleCampaign = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCampaign: (...a: any[]) => mockGetCampaign(...a),
    getCampaignRecipients: (...a: any[]) => mockGetCampaignRecipients(...a),
    testSendCampaign: (...a: any[]) => mockTestSendCampaign(...a),
    scheduleCampaign: (...a: any[]) => mockScheduleCampaign(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ campaignId: 'camp-1' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (v: string) => (v ? `formatted:${v}` : '-'),
}));

import MarketingCampaignDetailPage from './MarketingCampaignDetailPage';

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockCampaign = {
  name: 'Summer Sale 2025',
  campaign_type: 'promotional',
  status: 'draft',
  subject_template: 'Hot deals inside!',
  sent_at: '2025-06-01T10:00:00Z',
  total_recipients: 350,
};

const mockRecipients = [
  { id: 'r1', email: 'alice@test.com', status: 'sent', sent_at: '2025-06-01T10:05:00Z' },
  { id: 'r2', email: 'bob@test.com', status: 'opened', sent_at: '2025-06-01T10:06:00Z' },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function renderPage(storeId = 'store-1') {
  // Set localStorage before render
  if (storeId) {
    localStorage.setItem('crm_marketing_store_id', storeId);
  } else {
    localStorage.removeItem('crm_marketing_store_id');
  }
  return render(<MarketingCampaignDetailPage />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MarketingCampaignDetailPage BDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockGetCampaignRecipients.mockResolvedValue({ data: mockRecipients });
    mockTestSendCampaign.mockResolvedValue({});
    mockScheduleCampaign.mockResolvedValue({});
  });

  describe('Given no store is selected', () => {
    it('When rendered without storeId / Then shows store selection prompt', () => {
      renderPage('');
      expect(screen.getByText(/select a store from campaigns page first/i)).toBeInTheDocument();
    });

    it('When no storeId / Then does not call getCampaign API', () => {
      renderPage('');
      expect(mockGetCampaign).not.toHaveBeenCalled();
    });
  });

  describe('Given campaign data loads successfully', () => {
    it('When rendered / Then shows campaign name in heading', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Summer Sale 2025')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows campaign type and status', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/promotional/i)).toBeInTheDocument();
        expect(screen.getByText(/draft/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows subject template', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Hot deals inside!')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows total recipients count', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('350')).toBeInTheDocument();
      });
    });

    it('When rendered / Then calls getCampaign with storeId and campaignId', async () => {
      renderPage();
      await waitFor(() => {
        expect(mockGetCampaign).toHaveBeenCalledWith('store-1', 'camp-1');
      });
    });
  });

  describe('Given recipients table', () => {
    it('When data loads / Then shows recipient emails', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('alice@test.com')).toBeInTheDocument();
        expect(screen.getByText('bob@test.com')).toBeInTheDocument();
      });
    });

    it('When data loads / Then shows recipient statuses', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('sent')).toBeInTheDocument();
        expect(screen.getByText('opened')).toBeInTheDocument();
      });
    });

    it('When no recipients / Then shows empty state message', async () => {
      mockGetCampaignRecipients.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No recipients yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Given Test Send panel', () => {
    it('When rendered / Then shows Test Send section', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Test Send')).toBeInTheDocument();
      });
    });

    it('When email entered and Send Test clicked / Then calls testSendCampaign', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Test Send')).toBeInTheDocument());

      const input = screen.getByPlaceholderText('test@example.com');
      await user.type(input, 'tester@domain.com');
      await user.click(screen.getByRole('button', { name: /send test/i }));

      await waitFor(() => {
        expect(mockTestSendCampaign).toHaveBeenCalledWith('store-1', 'camp-1', 'tester@domain.com');
      });
    });
  });

  describe('Given Schedule panel', () => {
    it('When rendered / Then shows Schedule section', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Schedule')).toBeInTheDocument();
      });
    });

    it('When schedule date entered and Schedule clicked / Then calls scheduleCampaign', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Schedule')).toBeInTheDocument());

      const dateInput = screen.getByDisplayValue('');
      fireEvent.change(dateInput, { target: { value: '2025-08-01T09:00' } });
      fireEvent.click(screen.getByRole('button', { name: /^schedule$/i }));

      await waitFor(() => {
        expect(mockScheduleCampaign).toHaveBeenCalled();
      });
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetCampaign.mockRejectedValue(new Error('Failed to load campaign detail'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Failed to load campaign detail')).toBeInTheDocument();
      });
    });
  });

  describe('Given back navigation', () => {
    it('When back button clicked / Then navigates to campaigns page', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText(/back to campaigns/i)).toBeInTheDocument());
      fireEvent.click(screen.getByText(/back to campaigns/i));
      expect(mockNavigate).toHaveBeenCalledWith('/crm/marketing/campaigns');
    });
  });
});
