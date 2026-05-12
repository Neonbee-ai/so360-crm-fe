import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    getCampaign: vi.fn().mockResolvedValue(null),
    getCampaignRecipients: vi.fn().mockResolvedValue({ data: [] }),
    sendCampaignNow: vi.fn(),
    scheduleCampaign: vi.fn(),
    pauseCampaign: vi.fn(),
    testSendCampaign: vi.fn(),
  },
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d || '',
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ campaignId: 'camp-1' }),
}));

import MarketingCampaignDetailPage from './MarketingCampaignDetailPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('MarketingCampaignDetailPage', () => {
  it('shows store selection prompt when no store selected', () => {
    render(<MarketingCampaignDetailPage />);
    expect(screen.getByText(/select a store/i)).toBeInTheDocument();
  });

  it('renders when store is set', () => {
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    render(<MarketingCampaignDetailPage />);
    expect(document.body).toBeTruthy();
  });
});
