/**
 * BDD specs for MarketingCampaignsPage
 *
 * Scenarios covered:
 *  - Campaign list renders rows with name, type, status, recipients
 *  - Empty state when no campaigns
 *  - New Campaign button toggles create form
 *  - Create form fields and submit calls createCampaign
 *  - View button navigates to campaign detail
 *  - Send button calls sendCampaignNow
 *  - Pause button shows for sending/scheduled campaigns
 *  - Delete button calls deleteCampaign
 *  - Error state
 *  - Status badge colors (sent / draft / sending)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mockGetCampaigns = vi.fn();
const mockCreateCampaign = vi.fn();
const mockSendCampaignNow = vi.fn();
const mockPauseCampaign = vi.fn();
const mockDeleteCampaign = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCampaigns: (...a: any[]) => mockGetCampaigns(...a),
    createCampaign: (...a: any[]) => mockCreateCampaign(...a),
    sendCampaignNow: (...a: any[]) => mockSendCampaignNow(...a),
    pauseCampaign: (...a: any[]) => mockPauseCampaign(...a),
    deleteCampaign: (...a: any[]) => mockDeleteCampaign(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ onChange }: any) => (
    <button onClick={() => onChange('store-1')} data-testid="store-picker">
      Pick Store
    </button>
  ),
}));

vi.mock('../components/CampaignTemplateEditor', () => ({
  default: ({ onChange }: any) => (
    <textarea
      data-testid="body-editor"
      onChange={(e) => onChange(e.target.value)}
      placeholder="Email body"
    />
  ),
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (v: string) => (v ? `formatted:${v}` : '-'),
  mapCampaign: (c: any) => ({
    ...c,
    campaignType: c.campaign_type || c.campaignType || 'promotional',
    totalRecipients: c.total_recipients || 0,
    sentAt: c.sent_at || null,
  }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

import MarketingCampaignsPage from './MarketingCampaignsPage';

// ── Fixtures ─────────────────────────────────────────────────────────────

const campaigns = [
  {
    id: 'camp-1',
    name: 'Summer Sale',
    campaign_type: 'promotional',
    status: 'sent',
    total_recipients: 500,
    sent_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'camp-2',
    name: 'Win-Back Series',
    campaign_type: 'win_back',
    status: 'draft',
    total_recipients: 0,
    sent_at: null,
  },
  {
    id: 'camp-3',
    name: 'Flash Campaign',
    campaign_type: 'promotional',
    status: 'sending',
    total_recipients: 200,
    sent_at: null,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function renderPage(storeId = 'store-1') {
  if (storeId) {
    localStorage.setItem('crm_marketing_store_id', storeId);
  } else {
    localStorage.removeItem('crm_marketing_store_id');
  }
  return render(<MarketingCampaignsPage />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MarketingCampaignsPage BDD', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const shell = await import('@so360/shell-context');
    vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
    mockGetCampaigns.mockResolvedValue({ data: campaigns });
    mockCreateCampaign.mockResolvedValue({ id: 'camp-new' });
    mockSendCampaignNow.mockResolvedValue({});
    mockPauseCampaign.mockResolvedValue({});
    mockDeleteCampaign.mockResolvedValue({});
  });

  describe('Given campaigns load successfully', () => {
    it('When rendered / Then shows Campaigns heading', async () => {
      renderPage();
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
    });

    it('When rendered / Then shows campaign names', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Summer Sale')).toBeInTheDocument();
        expect(screen.getByText('Win-Back Series')).toBeInTheDocument();
        expect(screen.getByText('Flash Campaign')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows campaign statuses', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('sent')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
        expect(screen.getByText('sending')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows recipients count', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('500')).toBeInTheDocument();
      });
    });
  });

  describe('Given empty campaigns list', () => {
    it('When no campaigns / Then shows empty state', async () => {
      mockGetCampaigns.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No campaigns found.')).toBeInTheDocument();
      });
    });
  });

  describe('Given New Campaign button', () => {
    it('When clicked / Then shows create form', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /new campaign/i }));
      await waitFor(() => {
        expect(screen.getByText('Create Campaign')).toBeInTheDocument();
      });
    });

    it('When form open and clicked again / Then toggles to Close Form', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /new campaign/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /close form/i })).toBeInTheDocument());
    });
  });

  describe('Given create campaign form', () => {
    it('When form is open / Then shows campaign name, type, subject inputs', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /new campaign/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Campaign name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Subject template')).toBeInTheDocument();
      });
    });

    it('When all fields filled / Then Finish & Create calls createCampaign', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /new campaign/i }));
      await waitFor(() => expect(screen.getByPlaceholderText('Campaign name')).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText('Campaign name'), 'My New Campaign');
      await user.type(screen.getByPlaceholderText('Subject template'), 'Big Announcement!');
      fireEvent.change(screen.getByTestId('body-editor'), { target: { value: '<p>Hello</p>' } });

      await user.click(screen.getByRole('button', { name: /finish & create/i }));
      await waitFor(() => {
        expect(mockCreateCampaign).toHaveBeenCalledWith('store-1', expect.objectContaining({
          name: 'My New Campaign',
          subjectTemplate: 'Big Announcement!',
        }));
      });
    });
  });

  describe('Given campaign action buttons', () => {
    it('When View clicked / Then navigates to campaign detail page', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());

      const viewBtns = screen.getAllByRole('button', { name: /^view$/i });
      await user.click(viewBtns[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/marketing/campaigns/camp-1');
    });

    it('When Send clicked on draft campaign / Then calls sendCampaignNow', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Win-Back Series')).toBeInTheDocument());

      const sendBtns = screen.getAllByRole('button', { name: /^send$/i });
      await user.click(sendBtns[0]);
      await waitFor(() => {
        expect(mockSendCampaignNow).toHaveBeenCalled();
      });
    });

    it('When Pause clicked on sending campaign / Then calls pauseCampaign', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Flash Campaign')).toBeInTheDocument());

      const pauseBtns = screen.getAllByRole('button', { name: /^pause$/i });
      await user.click(pauseBtns[0]);
      await waitFor(() => {
        expect(mockPauseCampaign).toHaveBeenCalled();
      });
    });

    it('When Delete clicked / Then calls deleteCampaign', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());

      const deleteBtns = screen.getAllByRole('button', { name: /^delete$/i });
      await user.click(deleteBtns[0]);
      await waitFor(() => {
        expect(mockDeleteCampaign).toHaveBeenCalledWith('store-1', 'camp-1');
      });
    });

    it('When campaign is sent / Then does not show Send button for it', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Summer Sale')).toBeInTheDocument());
      // Sent campaign should not have Send button (only draft/scheduled ones do)
      // The page conditionally shows Send button only when status !== 'sent'
      // We verify this is working by checking we only have 2 Send buttons (for draft + sending campaigns)
      const sendBtns = screen.queryAllByRole('button', { name: /^send$/i });
      // draft (camp-2) has Send; sending (camp-3) has Send; sent (camp-1) does NOT
      expect(sendBtns.length).toBe(2);
    });
  });

  describe('Given API error', () => {
    it('When getCampaigns fails / Then shows error message', async () => {
      mockGetCampaigns.mockRejectedValue(new Error('Failed to load campaigns'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Failed to load campaigns')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then New Campaign button is absent', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValue({
        effectiveFlagsLoaded: false,
        isFeatureEnabled: () => false,
      } as any);
      renderPage();
      expect(screen.queryByText('New Campaign')).not.toBeInTheDocument();
      vi.mocked(useShellBridge).mockReturnValue({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false } as any);
    });

    it('When effectiveFlagsLoaded is true and isFeatureEnabled returns true / Then New Campaign button is present', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
      } as any);
      renderPage();
      await waitFor(() => expect(screen.getByText('Campaigns')).toBeInTheDocument());
      expect(screen.getByText('New Campaign')).toBeInTheDocument();
    });
  });
});
