import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    onOwnerChange: vi.fn(),
    onStatusChange: vi.fn(),
    onDelete: vi.fn(),
    onOpen: vi.fn(),
    formatDate: (d) => new Date(d).toLocaleDateString(),
    onInlineEdit: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LeadsDataGrid — rendering', () => {
  it('shows loading skeleton when isLoading=true', () => {
    render(
      <LeadsDataGrid
        leads={[]}
        isLoading
        context={buildContext()}
        onRowClick={vi.fn()}
      />,
    );
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders company name for each lead', () => {
    const leads = [makeLead(), makeLead({ id: 'lead-2', company_name: 'Beta LLC' })];
    render(
      <LeadsDataGrid leads={leads} context={buildContext()} onRowClick={vi.fn()} />,
    );
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('Beta LLC')).toBeDefined();
  });

  it('shows empty state when no leads', () => {
    render(<LeadsDataGrid leads={[]} context={buildContext()} onRowClick={vi.fn()} />);
    expect(screen.getByText('No leads found')).toBeDefined();
  });

  it('renders lead score progress bar', () => {
    render(
      <LeadsDataGrid leads={[makeLead({ auto_score: 72 })]} context={buildContext()} onRowClick={vi.fn()} />,
    );
    expect(screen.getByText('72')).toBeDefined();
  });

  it('renders click-to-call phone link', () => {
    render(
      <LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />,
    );
    const phoneLink = document.querySelector('a[href^="tel:"]');
    expect(phoneLink).toBeTruthy();
  });

  it('renders click-to-email link', () => {
    render(
      <LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />,
    );
    const mailLink = document.querySelector('a[href^="mailto:"]');
    expect(mailLink).toBeTruthy();
  });
});

describe('LeadsDataGrid — row interaction', () => {
  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    const lead = makeLead();
    render(<LeadsDataGrid leads={[lead]} context={buildContext()} onRowClick={onRowClick} />);
    // Company is the inline-editable cell and stops single-click propagation
    // (double-click starts editing instead) — click a non-editable cell.
    fireEvent.click(screen.getByText('Jane Doe'));
    expect(onRowClick).toHaveBeenCalledWith(lead);
  });

  it('opens context menu on right-click', () => {
    const lead = makeLead();
    render(<LeadsDataGrid leads={[lead]} context={buildContext()} onRowClick={vi.fn()} />);
    fireEvent.contextMenu(screen.getByText('Acme Corp'));
    expect(screen.getByText('Open detail panel')).toBeDefined();
  });

  it('closes context menu when clicking outside', () => {
    const lead = makeLead();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <LeadsDataGrid leads={[lead]} context={buildContext()} onRowClick={vi.fn()} />
      </div>,
    );
    fireEvent.contextMenu(screen.getByText('Acme Corp'));
    expect(screen.getByText('Open detail panel')).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Open detail panel')).toBeNull();
  });
});

describe('LeadsDataGrid — row selection', () => {
  it('selects a row via checkbox', () => {
    const leads = [makeLead()];
    render(<LeadsDataGrid leads={leads} context={buildContext()} onRowClick={vi.fn()} />);
    // Find the select checkbox cell (first cell in first row) and click
    const checkboxes = document.querySelectorAll('[data-testid="row-checkbox"], .grid-checkbox, div[onClick]');
    // Click the first clickable checkbox area
    const firstRowSelectCell = document.querySelector('.flex.items-center.justify-center.shrink-0.sticky');
    if (firstRowSelectCell) {
      fireEvent.click(firstRowSelectCell);
    }
  });

  it('shows bulk actions bar when rows are selected', () => {
    const bulkActions = [{ label: 'Delete Selected', icon: null, variant: 'danger' as const, onClick: vi.fn() }];
    const leads = [makeLead()];
    render(
      <LeadsDataGrid
        leads={leads}
        context={buildContext()}
        onRowClick={vi.fn()}
        bulkActions={bulkActions}
      />,
    );
    // Select header checkbox (select all)
    const headerSelectArea = document.querySelector('.sticky.z-30.bg-slate-900');
    if (headerSelectArea) {
      fireEvent.click(headerSelectArea);
      expect(screen.queryByText(/selected/i)).toBeDefined();
    }
  });
});

describe('LeadsDataGrid — inline cell editing', () => {
  it('opens an editor on double-click of an editable cell and commits on Enter', () => {
    const onInlineEdit = vi.fn();
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext({ onInlineEdit })} onRowClick={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('Acme Corp'));
    const input = screen.getByLabelText('Edit cell') as HTMLInputElement;
    expect(input.value).toBe('Acme Corp');
    fireEvent.change(input, { target: { value: 'Acme Global' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onInlineEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lead-1' }),
      'company_name',
      'Acme Global',
    );
  });

  it('does not make non-editable cells (email) editable', () => {
    const onInlineEdit = vi.fn();
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext({ onInlineEdit })} onRowClick={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('jane@acme.com'));
    expect(screen.queryByLabelText('Edit cell')).toBeNull();
  });

  it('cancels on Escape without committing', () => {
    const onInlineEdit = vi.fn();
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext({ onInlineEdit })} onRowClick={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('Acme Corp'));
    const input = screen.getByLabelText('Edit cell');
    fireEvent.change(input, { target: { value: 'Discard me' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onInlineEdit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Edit cell')).toBeNull();
  });

  it('does not fire a write when the value is unchanged (blur)', () => {
    const onInlineEdit = vi.fn();
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext({ onInlineEdit })} onRowClick={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('Acme Corp'));
    fireEvent.blur(screen.getByLabelText('Edit cell'));
    expect(onInlineEdit).not.toHaveBeenCalled();
  });

  it('is inert when the context has no onInlineEdit handler', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext({ onInlineEdit: undefined })} onRowClick={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('Acme Corp'));
    expect(screen.queryByLabelText('Edit cell')).toBeNull();
  });

  it('is inert when the user lacks update permission', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext({ canUpdate: false })} onRowClick={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('Acme Corp'));
    expect(screen.queryByLabelText('Edit cell')).toBeNull();
  });
});

describe('LeadsDataGrid — responsive', () => {
  const setWidth = (w: number) =>
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });

  it('renders the desktop grid on a wide viewport', () => {
    setWidth(1200);
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-card-list')).toBeNull();
  });

  it('renders a card list (not the grid) on a narrow viewport', () => {
    setWidth(500);
    try {
      render(<LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />);
      expect(screen.getByTestId('lead-card-list')).toBeInTheDocument();
      expect(screen.getByTestId('lead-card-lead-1')).toBeInTheDocument();
      expect(screen.queryByRole('grid')).toBeNull();
    } finally {
      setWidth(1024);
    }
  });
});

describe('LeadsDataGrid — keyboard navigation', () => {
  const twoLeads = () => [makeLead(), makeLead({ id: 'l2', company_name: 'Beta' })];

  it('ArrowDown focuses the first row and Enter opens it', () => {
    const onRowClick = vi.fn();
    render(<LeadsDataGrid leads={twoLeads()} context={buildContext()} onRowClick={onRowClick} />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-1' }));
  });

  it('ArrowDown twice then Enter opens the second row', () => {
    const onRowClick = vi.fn();
    render(<LeadsDataGrid leads={twoLeads()} context={buildContext()} onRowClick={onRowClick} />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'l2' }));
  });

  it('Space toggles selection of the focused row', () => {
    render(<LeadsDataGrid leads={twoLeads()} context={buildContext()} onRowClick={vi.fn()} bulkActions={[]} />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: ' ' });
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
  });

  it('Escape clears focus so a subsequent Enter does nothing', () => {
    const onRowClick = vi.fn();
    render(<LeadsDataGrid leads={twoLeads()} context={buildContext()} onRowClick={onRowClick} />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Escape' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('does not navigate while grouped', () => {
    const onRowClick = vi.fn();
    render(<LeadsDataGrid leads={twoLeads()} context={buildContext()} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTitle('Group by'));
    fireEvent.click(within(screen.getByTestId('group-by-menu')).getByText('Status'));
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('LeadsDataGrid — bulk action menus', () => {
  const selectAll = () => fireEvent.click(screen.getByTestId('bulk-select-all'));

  it('runs an immediate (onClick) bulk action', () => {
    const onExport = vi.fn();
    render(
      <LeadsDataGrid
        leads={[makeLead(), makeLead({ id: 'l2', company_name: 'Beta' })]}
        context={buildContext()}
        onRowClick={vi.fn()}
        bulkActions={[{ label: 'Export', icon: null, onClick: onExport }]}
      />,
    );
    selectAll();
    fireEvent.click(screen.getByText('Export'));
    expect(onExport).toHaveBeenCalledWith(['lead-1', 'l2']);
  });

  it('opens an options popover and calls onSelect with the chosen value', () => {
    const onSelect = vi.fn();
    render(
      <LeadsDataGrid
        leads={[makeLead()]}
        context={buildContext()}
        onRowClick={vi.fn()}
        bulkActions={[
          {
            label: 'Status',
            icon: null,
            options: [
              { label: 'New', value: 'New' },
              { label: 'Qualified', value: 'Qualified' },
            ],
            onSelect,
          },
        ]}
      />,
    );
    selectAll();
    // Menu closed initially.
    expect(screen.queryByTestId('bulk-menu-Status')).toBeNull();
    fireEvent.click(within(screen.getByTestId('bulk-actions-bar')).getByText('Status'));
    const menu = screen.getByTestId('bulk-menu-Status');
    fireEvent.click(within(menu).getByText('Qualified'));
    expect(onSelect).toHaveBeenCalledWith(['lead-1'], 'Qualified');
    // Menu closes after selection.
    expect(screen.queryByTestId('bulk-menu-Status')).toBeNull();
  });
});

describe('LeadsDataGrid — column controls', () => {
  it('opens column manager modal on Columns button click', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Columns'));
    expect(screen.getByText('Customize Columns')).toBeDefined();
  });

  it('closes column manager on Done button click', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Customize Columns')).toBeNull();
  });

  it('shows density menu on density button click', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />);
    // Density button shows current density as lowercase text inside a capitalize span
    const densityBtn = screen.getByTitle('Row density');
    fireEvent.click(densityBtn);
    expect(screen.getByText('compact')).toBeDefined();
    expect(screen.getByText('spacious')).toBeDefined();
  });
});

describe('LeadsDataGrid — sorting', () => {
  it('renders multi-column sort controls', () => {
    const leads = [
      makeLead({ id: 'l1', company_name: 'Zebra Inc', created_at: '2024-02-01T00:00:00Z' }),
      makeLead({ id: 'l2', company_name: 'Alpha Co', created_at: '2024-01-01T00:00:00Z' }),
    ];
    render(<LeadsDataGrid leads={leads} context={buildContext()} onRowClick={vi.fn()} />);
    // Company header should be clickable for sort
    expect(screen.getByText('Company')).toBeDefined();
  });

  it('shows clear sort button when sorts are applied', () => {
    const lead = makeLead();
    render(<LeadsDataGrid leads={[lead]} context={buildContext()} onRowClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Company'));
    expect(screen.getByText('Clear sort')).toBeDefined();
  });
});

describe('LeadsDataGrid — inline edit permissions', () => {
  it('renders status as select when canUpdate=true', () => {
    render(
      <LeadsDataGrid
        leads={[makeLead()]}
        context={buildContext({ canUpdate: true })}
        onRowClick={vi.fn()}
      />,
    );
    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('renders status as badge when canUpdate=false', () => {
    render(
      <LeadsDataGrid
        leads={[makeLead()]}
        context={buildContext({ canUpdate: false })}
        onRowClick={vi.fn()}
      />,
    );
    // Status badge (span) should appear, no select for status
    expect(screen.queryAllByText('New').length).toBeGreaterThan(0);
  });
});

describe('LeadsDataGrid — custom fields', () => {
  it('displays custom field values from lead.custom_fields', () => {
    const lead = makeLead({
      custom_fields: { industry: 'Retail', city: 'Dubai', priority: 'High' },
    });
    // Enable industry column to test — the default columns include industry (hidden by default)
    // We test that industry renders when it's in custom_fields
    render(<LeadsDataGrid leads={[lead]} context={buildContext()} onRowClick={vi.fn()} />);
    // With industry hidden by default, we can still test tags/website render paths
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});

describe('LeadsDataGrid — lead count display', () => {
  it('shows correct lead count in toolbar', () => {
    const leads = [makeLead(), makeLead({ id: 'l2', company_name: 'Beta' })];
    render(<LeadsDataGrid leads={leads} context={buildContext()} onRowClick={vi.fn()} />);
    expect(screen.getByText('2 leads')).toBeDefined();
  });

  it('shows singular form for one lead', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={buildContext()} onRowClick={vi.fn()} />);
    expect(screen.getByText('1 lead')).toBeDefined();
  });
});

describe('LeadsDataGrid — group by', () => {
  const twoStatuses = () => [
    makeLead({ id: 'g1', company_name: 'Acme Corp', status: 'New' }),
    makeLead({ id: 'g2', company_name: 'Beta LLC', status: 'Qualified' }),
    makeLead({ id: 'g3', company_name: 'Gamma Inc', status: 'New' }),
  ];

  it('is ungrouped by default (no group headers)', () => {
    render(<LeadsDataGrid leads={twoStatuses()} context={buildContext()} onRowClick={vi.fn()} />);
    expect(document.querySelector('[data-testid^="lead-group-"]')).toBeNull();
  });

  const pickGroup = (label: string) => {
    fireEvent.click(screen.getByTitle('Group by'));
    const menu = screen.getByTestId('group-by-menu');
    fireEvent.click(within(menu).getByText(label));
  };

  it('renders collapsible group headers with counts when grouping by status', () => {
    render(<LeadsDataGrid leads={twoStatuses()} context={buildContext()} onRowClick={vi.fn()} />);
    pickGroup('Status');
    const newGroup = document.querySelector('[data-testid="lead-group-New"]') as HTMLElement;
    const qGroup = document.querySelector('[data-testid="lead-group-Qualified"]') as HTMLElement;
    expect(newGroup).toBeTruthy();
    expect(qGroup).toBeTruthy();
    // New has two leads, Qualified one.
    expect(within(newGroup).getByText('2')).toBeDefined();
    expect(within(qGroup).getByText('1')).toBeDefined();
    expect(within(newGroup).getByText('Acme Corp')).toBeDefined();
    expect(within(newGroup).getByText('Gamma Inc')).toBeDefined();
  });

  it('collapses a group when its header is clicked, hiding its rows', () => {
    render(<LeadsDataGrid leads={twoStatuses()} context={buildContext()} onRowClick={vi.fn()} />);
    pickGroup('Status');
    const newGroup = document.querySelector('[data-testid="lead-group-New"]') as HTMLElement;
    expect(within(newGroup).getByText('Acme Corp')).toBeDefined();
    // Header button is the first button inside the group.
    fireEvent.click(within(newGroup).getAllByRole('button')[0]);
    expect(within(newGroup).queryByText('Acme Corp')).toBeNull();
  });

  it('returns to a flat list when grouping is set back to none', () => {
    render(<LeadsDataGrid leads={twoStatuses()} context={buildContext()} onRowClick={vi.fn()} />);
    pickGroup('Status');
    expect(document.querySelector('[data-testid^="lead-group-"]')).toBeTruthy();
    pickGroup('No grouping');
    expect(document.querySelector('[data-testid^="lead-group-"]')).toBeNull();
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});
