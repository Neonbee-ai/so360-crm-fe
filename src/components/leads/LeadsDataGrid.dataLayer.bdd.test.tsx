import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeadsDataGrid, GridContext } from './LeadsDataGrid';
import { Lead } from '../../types/crm';
import type { CrmCustomColumn } from '../../dataLayer/crmDataLayer';

// Data Layer Class B list columns on the leads grid.

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});

vi.mock('../../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatDate: (d: string) => new Date(d).toLocaleDateString(),
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

const USER = { id: 'u1', full_name: 'Alice Smith', email: 'alice@co.com' };

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    company_name: 'Acme Corp',
    first_name: 'Jane',
    last_name: 'Doe',
    contact_name: 'Jane Doe',
    contact_email: 'jane@acme.com',
    source: 'Website',
    status: 'New',
    owner: USER,
    creator: USER,
    created_at: '2024-01-15T10:00:00Z',
    activities: [],
    notes: [],
    custom_fields: {},
    ...overrides,
  } as Lead;
}

function ctx(): GridContext {
  return {
    users: [USER],
    leadStages: [{ id: 'new', name: 'New' }],
    canUpdate: true,
    canDelete: true,
    onOwnerChange: vi.fn(),
    onStatusChange: vi.fn(),
    onDelete: vi.fn(),
    onOpen: vi.fn(),
    formatDate: (d) => new Date(d).toLocaleDateString(),
    onInlineEdit: vi.fn(),
  };
}

const COLUMNS: CrmCustomColumn[] = [
  { key: 'plate', label: 'Vehicle Plate', fieldType: 'text', filterable: true, sortable: true },
  { key: 'notes_x', label: 'Private Notes', fieldType: 'text', filterable: false, sortable: false },
];

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('Feature: Data Layer columns on the leads grid', () => {
  it('Given no dataLayerColumns (flag off), When the grid renders, Then no Class B column header appears', () => {
    render(<LeadsDataGrid leads={[makeLead({ class_b_custom_fields: { plate: 'KL-07' } })]} context={ctx()} onRowClick={vi.fn()} />);
    expect(screen.queryByText('Vehicle Plate')).toBeNull();
    expect(screen.queryByText('KL-07')).toBeNull();
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });

  it('Given data layer columns, When the grid renders, Then headers and Class B values show, with an em dash for empty values', () => {
    render(
      <LeadsDataGrid
        leads={[makeLead({ class_b_custom_fields: { plate: 'KL-07' } })]}
        context={ctx()}
        onRowClick={vi.fn()}
        dataLayerColumns={COLUMNS}
      />,
    );
    expect(screen.getByText('Vehicle Plate')).toBeDefined();
    expect(screen.getByText('Private Notes')).toBeDefined();
    expect(screen.getByText('KL-07')).toBeDefined();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('Given the legacy meta_data custom_fields hold the same key, When the grid renders, Then the Class B column reads only class_b_custom_fields', () => {
    render(
      <LeadsDataGrid
        leads={[makeLead({ custom_fields: { plate: 'LEGACY' }, class_b_custom_fields: {} })]}
        context={ctx()}
        onRowClick={vi.fn()}
        dataLayerColumns={COLUMNS}
      />,
    );
    expect(screen.queryByText('LEGACY')).toBeNull();
  });

  it('Given an indexed column, When its header is clicked, Then rows sort by the Class B value', () => {
    const leads = [
      makeLead({ id: 'l1', company_name: 'First Co', class_b_custom_fields: { plate: 'ZZ-9' } }),
      makeLead({ id: 'l2', company_name: 'Second Co', class_b_custom_fields: { plate: 'AA-1' } }),
    ];
    render(<LeadsDataGrid leads={leads} context={ctx()} onRowClick={vi.fn()} dataLayerColumns={COLUMNS} />);
    const header = screen.getByText('Vehicle Plate');
    expect(header.closest('button')).not.toBeNull();
    fireEvent.click(header);
    const a = screen.getByText('AA-1');
    const z = screen.getByText('ZZ-9');
    // AA-1 now precedes ZZ-9 in document order
    expect(a.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Given a non-indexed column, When the grid renders, Then its header is display-only (no sort control)', () => {
    render(<LeadsDataGrid leads={[makeLead()]} context={ctx()} onRowClick={vi.fn()} dataLayerColumns={COLUMNS} />);
    const header = screen.getByText('Private Notes');
    expect(header.closest('button')).toBeNull();
  });
});
