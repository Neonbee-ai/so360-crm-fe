import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LeadsDataGrid, GridContext } from './LeadsDataGrid';
import { Lead } from '../../types/crm';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLocalStorage: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockLocalStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockLocalStorage[k] = v; },
  removeItem: (k: string) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]); },
});

vi.mock('../../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatDate: (d: string) => new Date(d).toLocaleDateString(),
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

vi.mock('../../hooks/useLeadGridPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useLeadGridPreferences')>();
  return actual; // use real hook (it uses stubbed localStorage)
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  { id: 'u1', full_name: 'Alice Smith', email: 'alice@co.com' },
  { id: 'u2', full_name: 'Bob Jones', email: 'bob@co.com' },
];

const MOCK_STAGES = [
  { id: 'new', name: 'New' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'lost', name: 'Lost' },
];

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    company_name: 'Acme Corp',
    first_name: 'Jane',
    last_name: 'Doe',
    contact_name: 'Jane Doe',
    contact_email: 'jane@acme.com',
    phone: '+1 555 0100',
    source: 'Website',
    status: 'New',
    owner: MOCK_USERS[0],
    creator: MOCK_USERS[0],
    created_at: '2024-01-15T10:00:00Z',
    activities: [],
    notes: [],
    custom_fields: {},
    auto_score: 72,
    ...overrides,
  };
}

function buildContext(overrides: Partial<GridContext> = {}): GridContext {
  return {
    users: MOCK_USERS,
    leadStages: MOCK_STAGES,
    canUpdate: true,
    canDelete: true,
    onOwnerChange: vi.fn(),
    onStatusChange: vi.fn(),
    onDelete: vi.fn(),
    onOpen: vi.fn(),
    formatDate: (d) => new Date(d).toLocaleDateString(),
    onInlineEdit: vi.fn(),
    ...overrides,
  };
}

const L = [
  makeLead({ id: 'l1', company_name: 'Mid Ltd', auto_score: 50, created_at: '2024-02-01T00:00:00Z', status: 'Qualified' }),
  makeLead({ id: 'l2', company_name: 'Zebra Inc', auto_score: 90, created_at: '2024-03-01T00:00:00Z', status: 'New' }),
  makeLead({ id: 'l3', company_name: 'Alpha Co', auto_score: 10, created_at: '2024-01-01T00:00:00Z', status: 'Lost' }),
];
const order = () => screen.getAllByText(/^(Mid Ltd|Zebra Inc|Alpha Co)$/).map((e) => e.textContent);
const renderGrid = (leads: Lead[] = L, props: any = {}) => {
  const onRowClick = vi.fn();
  render(<LeadsDataGrid leads={leads} context={buildContext()} onRowClick={onRowClick} {...props} />);
  return { onRowClick };
};
const hdr = (k: string) => screen.getByTestId(`sort-${k}`);

beforeEach(() => { Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]); });

describe('Feature LeadsDataGrid sort headers are Comb ghost Buttons', () => {
  describe('Scenario render', () => {
    it('Given sortable columns When rendered Then each header is a Comb ghost sm Button', () => {
      renderGrid();
      for (const k of ['company_name', 'contact_name', 'status', 'owner', 'lead_score', 'created_at']) {
        const b = hdr(k);
        expect(b).toHaveAttribute('data-comb', 'button');
        expect(b).toHaveAttribute('data-variant', 'ghost');
        expect(b).toHaveAttribute('data-size', 'sm');
        expect(b).toHaveAttribute('type', 'button');
      }
    });

    it('Given a header When rendered Then it shows its label and a sort icon', () => {
      renderGrid();
      expect(hdr('company_name')).toHaveTextContent('Company');
      expect(hdr('company_name').querySelector('svg')).not.toBeNull();
    });

    it('Given no sort When rendered Then every header has aria-sort none and no active text colour', () => {
      renderGrid();
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'none');
      expect(hdr('company_name').className).not.toContain('!text-fg');
      expect(screen.queryByText('Clear sort')).toBeNull();
    });
  });

  describe('Scenario sort cycle', () => {
    it('Given a header When clicked once Then ascending and rows ordered A to Z', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'ascending');
      expect(order()).toEqual(['Alpha Co', 'Mid Ltd', 'Zebra Inc']);
    });

    it('Given ascending When clicked again Then descending and rows reversed', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'descending');
      expect(order()).toEqual(['Zebra Inc', 'Mid Ltd', 'Alpha Co']);
    });

    it('Given descending When clicked a third time Then sort clears and original order returns', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      fireEvent.click(hdr('company_name'));
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'none');
      expect(order()).toEqual(['Mid Ltd', 'Zebra Inc', 'Alpha Co']);
    });

    it('Given a sorted header When rendered Then it has the active text token', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name').className).toContain('!text-fg');
    });

    it('Given ascending When shown Then the up chevron renders, and after desc the down chevron', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name').querySelector('[data-testid="icon-ChevronUp"]')).not.toBeNull();
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name').querySelector('[data-testid="icon-ChevronDown"]')).not.toBeNull();
    });

    it('Given a numeric column When sorted ascending Then rows order by score', () => {
      renderGrid();
      fireEvent.click(hdr('lead_score'));
      expect(order()).toEqual(['Alpha Co', 'Mid Ltd', 'Zebra Inc']);
      fireEvent.click(hdr('lead_score'));
      expect(order()).toEqual(['Zebra Inc', 'Mid Ltd', 'Alpha Co']);
    });

    it('Given a date column When sorted ascending Then rows order by date', () => {
      renderGrid();
      fireEvent.click(hdr('created_at'));
      expect(order()).toEqual(['Alpha Co', 'Mid Ltd', 'Zebra Inc']);
    });

    it('Given a status column When sorted ascending Then rows order by status text', () => {
      renderGrid();
      fireEvent.click(hdr('status'));
      expect(order()).toEqual(['Alpha Co', 'Zebra Inc', 'Mid Ltd']); // Lost, New, Qualified
    });

    it('Given two headers When both clicked Then both show ascending (multi-sort)', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      fireEvent.click(hdr('lead_score'));
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'ascending');
      expect(hdr('lead_score')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('Given a sort applied When Clear sort is clicked Then all headers reset', () => {
      renderGrid();
      fireEvent.click(hdr('company_name'));
      fireEvent.click(screen.getByText('Clear sort'));
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'none');
      expect(screen.queryByText('Clear sort')).toBeNull();
      expect(order()).toEqual(['Mid Ltd', 'Zebra Inc', 'Alpha Co']);
    });
  });

  describe('Scenario keyboard', () => {
    it('Given a focused header When Enter is pressed Then it sorts ascending', async () => {
      const user = userEvent.setup();
      renderGrid();
      hdr('company_name').focus();
      await user.keyboard('{Enter}');
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('Given a focused header When Space is pressed Then it sorts ascending', async () => {
      const user = userEvent.setup();
      renderGrid();
      hdr('company_name').focus();
      await user.keyboard(' ');
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('Given a focused header When Enter is pressed three times Then it cycles back to none', async () => {
      const user = userEvent.setup();
      renderGrid();
      hdr('company_name').focus();
      await user.keyboard('{Enter}{Enter}{Enter}');
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'none');
    });

    it('Given a header sorted by keyboard When Enter is pressed Then no row click fires', async () => {
      const user = userEvent.setup();
      const { onRowClick } = renderGrid();
      hdr('company_name').focus();
      await user.keyboard('{Enter}');
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('Given a header focused When Tab is pressed Then focus moves on to another focusable control', async () => {
      const user = userEvent.setup();
      renderGrid();
      hdr('company_name').focus();
      await user.tab();
      expect(hdr('company_name')).not.toHaveFocus();
    });
  });

  describe('Scenario rows, empty and loading', () => {
    it('Given leads When rendered Then every row shows', () => {
      renderGrid();
      expect(order()).toHaveLength(3);
    });

    it('Given a row When clicked Then onRowClick receives the lead', () => {
      const { onRowClick } = renderGrid();
      fireEvent.click(screen.getByText('Zebra Inc').closest('[class~="group/row"]')!);
      expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'l2' }));
    });

    it('Given a sorted grid When a row is clicked Then the sorted row is passed', () => {
      const { onRowClick } = renderGrid();
      fireEvent.click(hdr('company_name'));
      fireEvent.click(screen.getAllByText(/^(Mid Ltd|Zebra Inc|Alpha Co)$/)[0].closest('[class~="group/row"]')!);
      expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'l3' }));
    });

    it('Given a header When clicked Then the row click handler is not triggered', () => {
      const { onRowClick } = renderGrid();
      fireEvent.click(hdr('company_name'));
      // header lives outside the row container
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('Given no leads When rendered Then the empty state shows with headers still present', () => {
      renderGrid([]);
      expect(screen.getByText('No leads found')).toBeInTheDocument();
      expect(hdr('company_name')).toBeInTheDocument();
    });

    it('Given an empty grid When a header is clicked Then it sorts without error and stays empty', () => {
      renderGrid([]);
      fireEvent.click(hdr('company_name'));
      expect(hdr('company_name')).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getByText('No leads found')).toBeInTheDocument();
    });

    it('Given isLoading When rendered Then skeletons show and no sort headers', () => {
      renderGrid([], { isLoading: true });
      expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('sort-company_name')).toBeNull();
    });

    it('Given a single lead When sorted Then it stays rendered', () => {
      renderGrid([L[0]]);
      fireEvent.click(hdr('company_name'));
      expect(order()).toEqual(['Mid Ltd']);
    });

    it('Given leads with missing owner When sorted by owner Then no crash and all rows render', () => {
      renderGrid([makeLead({ id: 'a', company_name: 'Alpha Co', owner: undefined as any }), L[0]]);
      fireEvent.click(hdr('owner'));
      expect(order()).toHaveLength(2);
    });
  });
});
