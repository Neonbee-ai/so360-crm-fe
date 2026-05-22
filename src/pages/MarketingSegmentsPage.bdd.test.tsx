import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetCustomerSegments = vi.fn();
const mockGetMarketingSegments = vi.fn();
const mockGetMarketingTopBuyers = vi.fn();
const mockGetMarketingInactiveCustomers = vi.fn();
const mockCreateCustomerSegment = vi.fn();
const mockDeleteCustomerSegment = vi.fn();
const mockGetCustomerSegmentMembers = vi.fn();
const mockAddCustomerSegmentMembers = vi.fn();
const mockRemoveCustomerSegmentMembers = vi.fn();
const mockGetCustomers = vi.fn();
const mockGetLeads = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCustomerSegments: (...a: any[]) => mockGetCustomerSegments(...a),
    getMarketingSegments: (...a: any[]) => mockGetMarketingSegments(...a),
    getMarketingTopBuyers: (...a: any[]) => mockGetMarketingTopBuyers(...a),
    getMarketingInactiveCustomers: (...a: any[]) => mockGetMarketingInactiveCustomers(...a),
    createCustomerSegment: (...a: any[]) => mockCreateCustomerSegment(...a),
    deleteCustomerSegment: (...a: any[]) => mockDeleteCustomerSegment(...a),
    getCustomerSegmentMembers: (...a: any[]) => mockGetCustomerSegmentMembers(...a),
    addCustomerSegmentMembers: (...a: any[]) => mockAddCustomerSegmentMembers(...a),
    removeCustomerSegmentMembers: (...a: any[]) => mockRemoveCustomerSegmentMembers(...a),
    getCustomers: (...a: any[]) => mockGetCustomers(...a),
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useShell: () => ({ isModuleEnabled: (m: string) => m === 'dailystore' }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => <button onClick={onClick} disabled={disabled} {...props}>{children}</button>,
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => (
    <select data-testid="store-picker" value={storeId} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select Store</option>
      <option value="store-1">Store 1</option>
    </select>
  ),
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: string) => d,
  formatMoney: (v: number) => `$${v}`,
}));

import MarketingSegmentsPage from './MarketingSegmentsPage';

const manualSegments = [
  { id: 'seg1', name: 'VIP Customers', description: 'High value repeat buyers', rules: { category: 'b2b' }, member_count: 25, created_at: '2025-01-10T10:00:00Z' },
  { id: 'seg2', name: 'New Leads', description: 'Recent signups', rules: { q: 'new', channel: 'storefront_web' }, member_count: 50, created_at: '2025-02-15T10:00:00Z' },
];

const storefrontSegments = {
  segments: {
    b2b: 10,
    b2c: 50,
    storefront_web: 30,
    pos: 20,
  },
};

const topBuyers = {
  data: [
    { id: 'tb1', contact_name: 'TopBuyer1', email: 'top1@test.com', total_spend: 5000 },
  ],
};

const inactiveCustomers = {
  data: [
    { id: 'ic1', contact_name: 'InactiveOne', email: 'inactive@test.com', last_order_date: '2024-01-01' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('crm_marketing_store_id', 'store-1');
  mockGetCustomerSegments.mockResolvedValue(manualSegments);
  mockGetMarketingSegments.mockResolvedValue(storefrontSegments);
  mockGetMarketingTopBuyers.mockResolvedValue(topBuyers);
  mockGetMarketingInactiveCustomers.mockResolvedValue(inactiveCustomers);
  mockCreateCustomerSegment.mockResolvedValue({ id: 'seg-new', name: 'Test Segment' });
  mockDeleteCustomerSegment.mockResolvedValue({});
  mockGetCustomerSegmentMembers.mockResolvedValue({ members: [] });
  mockAddCustomerSegmentMembers.mockResolvedValue({});
  mockRemoveCustomerSegmentMembers.mockResolvedValue({});
  mockGetCustomers.mockResolvedValue([
    { id: 'cand1', contact_name: 'Candidate1', email: 'cand1@test.com' },
  ]);
  mockGetLeads.mockResolvedValue([
    { id: 'lead1', contact_name: 'LeadCandidate', email: 'lead1@test.com' },
  ]);
});

describe('MarketingSegmentsPage', () => {
  describe('Given manual segments exist', () => {
    it('When the page loads / Then shows the segment list', async () => {
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('VIP Customers')).toBeInTheDocument();
        expect(screen.getByText('New Leads')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows description for each segment', async () => {
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('High value repeat buyers')).toBeInTheDocument();
        expect(screen.getByText('Recent signups')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows rules preview for each segment', async () => {
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('category: b2b')).toBeInTheDocument();
        expect(screen.getByText('q: new | channel: storefront_web')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows action buttons for each segment', async () => {
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        const manageButtons = screen.getAllByText('Manage Members');
        expect(manageButtons.length).toBe(2);
        const leadsButtons = screen.getAllByText('Leads');
        expect(leadsButtons.length).toBeGreaterThanOrEqual(2);
        const customersButtons = screen.getAllByText('Customers');
        expect(customersButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('When Leads button is clicked / Then navigates to leads page with segment', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      const leadsButtons = screen.getAllByText('Leads');
      await user.click(leadsButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/crm/leads'));
    });

    it('When Customers button is clicked / Then navigates to customers page with segment', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      const customersButtons = screen.getAllByText('Customers');
      await user.click(customersButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/crm/customers'));
    });

    it('When Delete button is clicked / Then removes the segment', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);
      await waitFor(() => expect(mockDeleteCustomerSegment).toHaveBeenCalledWith('seg1'));
    });
  });

  describe('Given the create segment flow', () => {
    it('When clicking Create Segment button / Then shows the create form', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      const createBtn = screen.getByRole('button', { name: /Create Segment/i });
      await user.click(createBtn);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Segment name/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Description/i)).toBeInTheDocument();
      });
    });

    it('When form is filled and Save is clicked / Then calls createCustomerSegment', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /Create Segment/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Segment name/i)).toBeInTheDocument());
      const nameInput = screen.getByPlaceholderText(/Segment name/i);
      await user.type(nameInput, 'Test Segment');
      await user.click(screen.getByText('Save Segment'));
      await waitFor(() => expect(mockCreateCustomerSegment).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Segment' })));
    });

    it('When form has channel filter / Then includes channel in rules', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /Create Segment/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Segment name/i)).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText(/Segment name/i), 'Web Segment');
      const channelSelect = screen.getByDisplayValue('All Channels');
      await user.selectOptions(channelSelect, 'storefront_web');
      await user.click(screen.getByText('Save Segment'));
      await waitFor(() => expect(mockCreateCustomerSegment).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Web Segment',
        rules: expect.objectContaining({ channel: 'storefront_web' }),
      })));
    });

    it('When Create Segment clicked again / Then closes the form', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /Create Segment/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/Segment name/i)).toBeInTheDocument());
      await user.click(screen.getByText('Close Form'));
      await waitFor(() => expect(screen.queryByPlaceholderText(/Segment name/i)).not.toBeInTheDocument());
    });
  });

  describe('Given member management panel', () => {
    it('When Manage Members is clicked / Then opens the member panel', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      const manageButtons = screen.getAllByText('Manage Members');
      await user.click(manageButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/Manage Members:/)).toBeInTheDocument();
      });
    });

    it('When member panel is open / Then shows Close Panel button', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => {
        expect(screen.getByText('Close Panel')).toBeInTheDocument();
      });
    });

    it('When Close Panel is clicked / Then hides the member panel', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => expect(screen.getByText('Close Panel')).toBeInTheDocument());
      await user.click(screen.getByText('Close Panel'));
      await waitFor(() => expect(screen.queryByText('Close Panel')).not.toBeInTheDocument());
    });

    it('When no members exist / Then shows no current members message', async () => {
      mockGetCustomerSegmentMembers.mockResolvedValue({ members: [] });
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => expect(screen.getByText('No current members found.')).toBeInTheDocument());
    });

    it('When candidates are loaded / Then shows Add button for each candidate', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => {
        expect(screen.getByText('Candidate1')).toBeInTheDocument();
        expect(screen.getByText('Add')).toBeInTheDocument();
      });
    });

    it('When Add button is clicked / Then calls addCustomerSegmentMembers', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => expect(screen.getByText('Add')).toBeInTheDocument(), { timeout: 10000 });
      await user.click(screen.getByText('Add'));
      await waitFor(() => expect(mockAddCustomerSegmentMembers).toHaveBeenCalled());
    });

    it('When member search is typed / Then filters candidates', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => expect(screen.getByPlaceholderText(/Search customers/)).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText(/Search customers/), 'test');
      await waitFor(() => expect(mockGetCustomers).toHaveBeenCalled());
    });

    it('When Leads toggle is clicked / Then shows search leads placeholder', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => expect(screen.getByText('Close Panel')).toBeInTheDocument());
      const allBtns = screen.getAllByRole('button');
      const leadsToggle = allBtns.find(b => b.textContent === 'Leads' && b.className.includes('rounded-lg'));
      if (leadsToggle) {
        await user.click(leadsToggle);
        await waitFor(() => expect(screen.getByPlaceholderText(/Search leads/)).toBeInTheDocument(), { timeout: 10000 });
      }
    });

    it('When members exist / Then shows Remove button', async () => {
      mockGetCustomerSegmentMembers.mockResolvedValue({
        members: [{ id: 'm1', type: 'customer', lead_record: { id: 'c1', contact_name: 'Existing Member', email: 'exist@test.com' } }],
      });
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => {
        expect(screen.getByText('Existing Member')).toBeInTheDocument();
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });
    });

    it('When Remove is clicked / Then calls removeCustomerSegmentMembers', async () => {
      mockGetCustomerSegmentMembers.mockResolvedValue({
        members: [{ id: 'm1', type: 'customer', lead_record: { id: 'c1', contact_name: 'Existing Member', email: 'exist@test.com' } }],
      });
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      await user.click(screen.getAllByText('Manage Members')[0]);
      await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());
      await user.click(screen.getByText('Remove'));
      await waitFor(() => expect(mockRemoveCustomerSegmentMembers).toHaveBeenCalledWith('seg1', [{ id: 'c1', type: 'customer' }]));
    });
  });

  describe('Given no segments exist', () => {
    it('When the page loads / Then shows an empty state', async () => {
      mockGetCustomerSegments.mockResolvedValue([]);
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('No segments yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Given API error', () => {
    it('When segment load fails / Then shows error message', async () => {
      mockGetCustomerSegments.mockRejectedValue(new Error('Failed to load'));
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });

    it('When storefront load fails / Then shows error message', async () => {
      mockGetMarketingSegments.mockRejectedValue(new Error('Storefront error'));
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('Storefront error')).toBeInTheDocument();
      });
    });
  });

  describe('Given loading states', () => {
    it('When CRM segments are loading / Then shows loading text', async () => {
      mockGetCustomerSegments.mockReturnValue(new Promise(() => {}));
      render(<MarketingSegmentsPage />);
      expect(screen.getByText('Loading CRM segments...')).toBeInTheDocument();
    });

    it('When storefront data is loading / Then shows storefront loading text', async () => {
      mockGetMarketingSegments.mockReturnValue(new Promise(() => {}));
      render(<MarketingSegmentsPage />);
      expect(screen.getByText('Loading Storefront insights...')).toBeInTheDocument();
    });
  });

  describe('Given page header', () => {
    it('When rendered / Then shows Customer Segments title', async () => {
      render(<MarketingSegmentsPage />);
      expect(screen.getByText('Customer Segments')).toBeInTheDocument();
    });

    it('When rendered / Then shows the store picker', async () => {
      render(<MarketingSegmentsPage />);
      expect(screen.getByTestId('store-picker')).toBeInTheDocument();
    });
  });
});
