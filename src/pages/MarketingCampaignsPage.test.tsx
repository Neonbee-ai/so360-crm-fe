import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetCampaigns = vi.fn();
const mockCreateCampaign = vi.fn();
const mockDeleteCampaign = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCampaigns: (...a: any[]) => mockGetCampaigns(...a),
    createCampaign: (...a: any[]) => mockCreateCampaign(...a),
    deleteCampaign: (...a: any[]) => mockDeleteCampaign(...a),
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => (
    <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}>
      <option value="">Select</option>
      <option value="store-1">Store 1</option>
    </select>
  ),
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d || '',
  mapCampaign: (c: any) => c,
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('../components/CampaignTemplateEditor', () => ({
  default: () => <div data-testid="template-editor" />,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import MarketingCampaignsPage from './MarketingCampaignsPage';

const campaigns = [
  { id: 'c1', name: 'Summer Sale', status: 'draft', campaignType: 'promotional', created_at: '2024-06-01', sentCount: 0 },
  { id: 'c2', name: 'Newsletter', status: 'sent', campaignType: 'newsletter', created_at: '2024-05-01', sentCount: 100 },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetCampaigns.mockResolvedValue({ data: campaigns });
  mockCreateCampaign.mockResolvedValue({ id: 'c-new' });
  mockDeleteCampaign.mockResolvedValue({});
});

describe('MarketingCampaignsPage', () => {
  it('renders store picker', () => {
    render(<MarketingCampaignsPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });

  it('loads campaigns when store selected', async () => {
    render(<MarketingCampaignsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(mockGetCampaigns).toHaveBeenCalledWith('store-1', expect.any(Object));
      expect(screen.getByText('Summer Sale')).toBeInTheDocument();
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
    });
  });

  it('shows error state on load failure', async () => {
    mockGetCampaigns.mockRejectedValue(new Error('API Error'));
    render(<MarketingCampaignsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('shows create campaign form', async () => {
    render(<MarketingCampaignsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => screen.getByText('Summer Sale'));
    const createBtn = screen.getByText(/^New Campaign$/i);
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(screen.getByTestId('template-editor')).toBeInTheDocument();
    });
  });

  it('persists store to localStorage', () => {
    render(<MarketingCampaignsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    expect(localStorage.getItem('crm_marketing_store_id')).toBe('store-1');
  });
});
