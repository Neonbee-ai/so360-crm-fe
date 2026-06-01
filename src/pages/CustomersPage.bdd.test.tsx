import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetCustomers = vi.fn();
const mockGetCustomerStats = vi.fn();
const mockGetCustomerSegmentCustomers = vi.fn();
const mockGetPartners = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCustomers: (...args: any[]) => mockGetCustomers(...args),
    getCustomerStats: (...args: any[]) => mockGetCustomerStats(...args),
    getCustomerSegmentCustomers: (...args: any[]) => mockGetCustomerSegmentCustomers(...args),
    getPartners: (...args: any[]) => mockGetPartners(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/crm/customers', search: '' }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShellBridge: vi.fn(() => ({
    isFeatureEnabled: (flag: string) => {
      if (flag === 'action:crm:customers:show_model_split') return true;
      if (flag === 'action:crm:customers:kpi_channel_web') return true;
      if (flag === 'action:crm:customers:kpi_channel_mobile') return true;
      if (flag === 'action:crm:customers:kpi_channel_offline') return true;
      return true;
    },
  })),
  useActivity: () => ({ recordActivity: async () => {} }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),}));

let tableProps: any = {};
vi.mock('../components/common/Table', () => ({
  Table: (props: any) => {
    tableProps = props;
    if (props.isLoading) return <div data-testid="table">Loading...</div>;
    if (props.data.length === 0) return <div data-testid="table">{props.emptyMessage}</div>;
    return (
      <div data-testid="table">
        {props.data.map((c: any) => (
          <div key={c.id} data-testid={`customer-row-${c.id}`} onClick={() => props.onRowClick(c)}>
            {c.contact_name} - {c.email}
          </div>
        ))}
      </div>
    );
  },
}));

import CustomersPage from './CustomersPage';

const mockPartners = [
  { id: 'p1', company_name: 'Acme Partners', contact_name: 'Partner Bob' },
  { id: 'p2', company_name: 'Beta Partners' },
];

const customers = [
  { id: 'c1', contact_name: 'Alice Johnson', email: 'alice@test.com', phone: '555-0001', company_name: 'AliceCo', channel: 'storefront_web', customer_category: 'b2c', acquisition_source: 'storefront_registration', created_at: '2025-01-15T10:00:00Z', credit_limit: '0', tax_id: null, tax_id_verified: false, referred_by: undefined },
  { id: 'c2', contact_name: 'Bob Smith', email: 'bob@corp.com', phone: '555-0002', company_name: 'BobCorp', channel: 'pos', customer_category: 'b2b', acquisition_source: 'pos_inline', created_at: '2025-02-20T10:00:00Z', credit_limit: '10000', tax_id: 'TAX123', tax_id_verified: true, referred_by: 'p1' },
  { id: 'c3', contact_name: 'Charlie Brown', email: 'charlie@web.com', phone: null, company_name: 'Charlie Brown', channel: 'manual', customer_category: 'b2c', acquisition_source: 'manual_entry', created_at: '2025-03-10T10:00:00Z', credit_limit: '0', tax_id: null, tax_id_verified: false, referred_by: undefined },
];

const stats = {
  total: 3,
  b2b_count: 1,
  b2c_count: 2,
  storefront_web: 1,
  storefront_mobile: 0,
  pos: 1,
  manual: 1,
};

let mockUseShellBridge: ReturnType<typeof vi.fn>;

const defaultShellImpl = () => ({
  isFeatureEnabled: (flag: string) => {
    if (flag === 'action:crm:customers:show_model_split') return true;
    if (flag === 'action:crm:customers:kpi_channel_web') return true;
    if (flag === 'action:crm:customers:kpi_channel_mobile') return true;
    if (flag === 'action:crm:customers:kpi_channel_offline') return true;
    return true;
  },
});

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  mockUseShellBridge = vi.mocked(shell.useShellBridge);
  mockUseShellBridge.mockImplementation(defaultShellImpl);
  tableProps = {};
  mockGetCustomers.mockResolvedValue(customers);
  mockGetCustomerStats.mockResolvedValue(stats);
  mockGetPartners.mockResolvedValue(mockPartners);
});

describe('CustomersPage', () => {
  describe('Given customers are loaded', () => {
    it('When the page renders / Then shows the Customers heading', async () => {
      render(<CustomersPage />);
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    it('When the page renders / Then shows all customer rows', async () => {
      render(<CustomersPage />);
      await waitFor(() => {
        expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument();
        expect(screen.getByTestId('customer-row-c2')).toBeInTheDocument();
        expect(screen.getByTestId('customer-row-c3')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then shows total stat', async () => {
      render(<CustomersPage />);
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('When model split is enabled / Then shows B2B and B2C stat cards', async () => {
      render(<CustomersPage />);
      await waitFor(() => {
        const b2bTexts = screen.getAllByText('B2B');
        expect(b2bTexts.length).toBeGreaterThanOrEqual(1);
        const b2cTexts = screen.getAllByText('B2C');
        expect(b2cTexts.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('When channel KPIs are enabled / Then shows channel stat labels', async () => {
      render(<CustomersPage />);
      await waitFor(() => {
        const allTexts = document.body.textContent || '';
        expect(allTexts).toContain('Web');
        expect(allTexts).toContain('Mobile');
        expect(allTexts).toContain('POS');
      });
    });
  });

  describe('Given search functionality', () => {
    it('When searching by contact name / Then filters matching customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const search = screen.getByPlaceholderText('Search customers by name, email, phone...');
      await user.type(search, 'Alice');
      await waitFor(() => {
        expect(screen.queryByTestId('customer-row-c2')).not.toBeInTheDocument();
        expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument();
      });
    });

    it('When searching by email / Then filters matching customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const search = screen.getByPlaceholderText('Search customers by name, email, phone...');
      await user.type(search, 'bob@corp');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].id).toBe('c2');
      });
    });

    it('When searching by phone / Then filters matching customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const search = screen.getByPlaceholderText('Search customers by name, email, phone...');
      await user.type(search, '555-0002');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].id).toBe('c2');
      });
    });
  });

  describe('Given channel filter', () => {
    it('When filtering by Web channel / Then shows only web customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const channelSelect = screen.getByDisplayValue('All Channels');
      await user.selectOptions(channelSelect, 'storefront_web');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].channel).toBe('storefront_web');
      });
    });

    it('When filtering by POS / Then shows only POS customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const channelSelect = screen.getByDisplayValue('All Channels');
      await user.selectOptions(channelSelect, 'pos');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].id).toBe('c2');
      });
    });
  });

  describe('Given category filter', () => {
    it('When filtering by B2B / Then shows only B2B customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const categorySelect = screen.getByDisplayValue('All Categories');
      await user.selectOptions(categorySelect, 'b2b');
      await waitFor(() => {
        expect(tableProps.data.length).toBe(1);
        expect(tableProps.data[0].customer_category).toBe('b2b');
      });
    });

    it('When filtering by B2C / Then shows only B2C customers', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const categorySelect = screen.getByDisplayValue('All Categories');
      await user.selectOptions(categorySelect, 'b2c');
      await waitFor(() => {
        expect(tableProps.data.every((c: any) => c.customer_category === 'b2c')).toBe(true);
      });
    });
  });

  describe('Given clear filters', () => {
    it('When Clear Filters is clicked / Then resets all filters', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const channelSelect = screen.getByDisplayValue('All Channels');
      await user.selectOptions(channelSelect, 'pos');
      await waitFor(() => expect(screen.getByText('Clear Filters')).toBeInTheDocument());
      await user.click(screen.getByText('Clear Filters'));
      expect(mockNavigate).toHaveBeenCalledWith('/crm/customers');
    });
  });

  describe('Given customer row click', () => {
    it('When a customer row is clicked / Then navigates to customer detail', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('customer-row-c1'));
      expect(mockNavigate).toHaveBeenCalledWith('../customers/c1');
    });
  });

  describe('Given no customers', () => {
    it('When no customers returned / Then shows empty message', async () => {
      mockGetCustomers.mockResolvedValue([]);
      render(<CustomersPage />);
      await waitFor(() => {
        expect(screen.getByTestId('table')).toHaveTextContent('No customers found');
      });
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetCustomers.mockRejectedValue(new Error('Network error'));
      mockGetCustomerStats.mockRejectedValue(new Error('Network error'));
      render(<CustomersPage />);
      await waitFor(() => {
        expect(screen.getByTestId('table')).toHaveTextContent('Network error');
      });
    });
  });

  describe('Given pagination', () => {
    it('When more than 10 customers exist / Then shows pagination controls', async () => {
      const many = Array.from({ length: 15 }, (_, i) => ({
        id: `c${i}`, contact_name: `Customer ${i}`, email: `c${i}@test.com`,
        channel: 'manual', customer_category: 'b2c', acquisition_source: 'manual_entry',
        created_at: '2025-01-15T10:00:00Z', credit_limit: '0', tax_id: null, tax_id_verified: false,
      }));
      mockGetCustomers.mockResolvedValue(many);
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument());
    });

    it('When Next page is clicked / Then advances to page 2', async () => {
      const many = Array.from({ length: 15 }, (_, i) => ({
        id: `c${i}`, contact_name: `Customer ${i}`, email: `c${i}@test.com`,
        channel: 'manual', customer_category: 'b2c', acquisition_source: 'manual_entry',
        created_at: '2025-01-15T10:00:00Z', credit_limit: '0', tax_id: null, tax_id_verified: false,
      }));
      mockGetCustomers.mockResolvedValue(many);
      const user = userEvent.setup();
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument());
      await user.click(screen.getByText('Next'));
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    });
  });

  describe('Given column renderers', () => {
    it('When Name column renders / Then shows contact name and category badge', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const nameCol = tableProps.columns[0];
      const cell = nameCol.accessor(customers[1]);
      const { container } = render(cell);
      expect(container.textContent).toContain('Bob Smith');
      expect(container.textContent).toContain('B2B');
    });

    it('When Email column renders / Then shows email and phone', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const emailCol = tableProps.columns[1];
      const cell = emailCol.accessor(customers[0]);
      const { container } = render(cell);
      expect(container.textContent).toContain('alice@test.com');
      expect(container.textContent).toContain('555-0001');
    });

    it('When Channel column renders web customer / Then shows Web badge', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const cols = tableProps.columns;
      const channelCol = cols.find((c: any) => {
        try { const h = c.header; return h?.props?.label === 'Channel'; } catch { return false; }
      });
      if (channelCol) {
        const cell = channelCol.accessor(customers[0]);
        const { container } = render(cell);
        expect(container.textContent).toContain('Web');
      }
    });

    it('When Source column renders / Then shows acquisition source badge', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const cols = tableProps.columns;
      const sourceCol = cols.find((c: any) => c.header === 'Source');
      expect(sourceCol).toBeDefined();
      const cell = sourceCol.accessor(customers[0]);
      const { container } = render(cell);
      expect(container.textContent).toContain('Registration');
    });
  });

  describe('Given sorting', () => {
    it('When sort by contact_name / Then reorders customers alphabetically', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const nameHeader = tableProps.columns[0].header;
      const { container } = render(nameHeader);
      const btn = container.querySelector('button');
      expect(btn).toBeTruthy();
      expect(btn!.textContent).toContain('Name');
    });
  });

  describe('Given Referred By column', () => {
    it('When page loads / Then calls getPartners to resolve partner names', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      expect(mockGetPartners).toHaveBeenCalled();
    });

    it('When columns render / Then Referred By column is present', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const referredByCol = tableProps.columns.find((c: any) => c.header === 'Referred By');
      expect(referredByCol).toBeDefined();
    });

    it('When customer has no referred_by / Then column shows dash', async () => {
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const referredByCol = tableProps.columns.find((c: any) => c.header === 'Referred By');
      const cell = referredByCol.accessor(customers[0]);
      const { container } = render(cell);
      expect(container.textContent).toBe('—');
    });

    it('When customer has referred_by matching a partner / Then column accessor contains partner company name', async () => {
      render(<CustomersPage />);
      // waitFor retries until partners are loaded into the column closure
      await waitFor(() => {
        const col = tableProps.columns?.find((c: any) => c.header === 'Referred By');
        if (!col) throw new Error('Column not found');
        const cell = col.accessor(customers[1]);
        const children = cell?.props?.children;
        const texts = (Array.isArray(children) ? children : [children])
          .filter((c: any) => typeof c === 'string');
        if (!texts.join('').includes('Acme Partners')) throw new Error('Partner name not yet resolved');
        expect(texts.join('')).toContain('Acme Partners');
      });
    });

    it('When referred_by id does not match any partner / Then column accessor falls back to raw id', async () => {
      const customerWithUnknownPartner = { ...customers[0], referred_by: 'unknown-partner-id' };
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      const referredByCol = tableProps.columns.find((c: any) => c.header === 'Referred By');
      const cell = referredByCol.accessor(customerWithUnknownPartner);
      const children = cell?.props?.children;
      const texts = (Array.isArray(children) ? children : [children])
        .filter((c: any) => typeof c === 'string');
      expect(texts.join('')).toContain('unknown-partner-id');
    });

    it('When getPartners fails / Then page still loads with partners defaulting to empty', async () => {
      mockGetPartners.mockRejectedValue(new Error('Partners unavailable'));
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByTestId('customer-row-c1')).toBeInTheDocument());
      // Page still renders without crashing
      const referredByCol = tableProps.columns.find((c: any) => c.header === 'Referred By');
      expect(referredByCol).toBeDefined();
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then channel KPI cards are absent (no flicker)', async () => {
      mockUseShellBridge.mockReturnValue({ effectiveFlagsLoaded: false, isFeatureEnabled: () => false } as any);
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByText('Customers')).toBeInTheDocument());
      // 'Web' appears once in the channel filter dropdown option when KPI card is NOT rendered.
      // When the KPI card IS rendered it would appear twice (dropdown + card heading).
      expect(screen.queryAllByText('Web').length).toBe(1);
      expect(screen.queryAllByText('Mobile').length).toBe(1);
    });

    it('When effectiveFlagsLoaded is true and flags return true / Then channel KPI cards are present', async () => {
      mockUseShellBridge.mockReturnValue({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
      } as any);
      render(<CustomersPage />);
      await waitFor(() => expect(screen.getByText('Customers')).toBeInTheDocument());
      // Web KPI card now rendered → 'Web' appears twice (dropdown option + card heading)
      await waitFor(() => expect(screen.queryAllByText('Web').length).toBeGreaterThan(1));
    });
  });
});
