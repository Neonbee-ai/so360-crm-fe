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

const order = (first: string, second: string) =>
  !!(screen.getByText(first).compareDocumentPosition(screen.getByText(second)) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Feature: Data Layer columns placement and sorting edge cases', () => {
  describe('Scenario: the saved preferences hide the actions column', () => {
    it('then the Class B columns are appended at the end of the visible columns', () => {
      // Given grid prefs where the actions column is hidden
      store.crm_leads_grid_prefs_v2 = JSON.stringify({ columns: [{ key: 'actions', visible: false, width: 56, pinned: false, order: 99 }] });
      // When
      render(<LeadsDataGrid leads={[makeLead({ class_b_custom_fields: { plate: 'KL-07' } })]} context={ctx()} onRowClick={vi.fn()} dataLayerColumns={COLUMNS} />);
      // Then the Class B headers render and the last header is the last Class B column
      const headers = screen.getAllByText(/Vehicle Plate|Private Notes|Next Follow-up/);
      expect(headers.map((h) => h.textContent)).toEqual(['Next Follow-up', 'Vehicle Plate', 'Private Notes']);
      expect(screen.getByText('KL-07')).toBeDefined();
    });
  });

  describe('Scenario: sorting by a native column that has no comparator', () => {
    it('then the incoming lead order is kept', () => {
      // Given two leads in a fixed order
      const leads = [
        makeLead({ id: 'l1', company_name: 'Zeta Co', class_b_custom_fields: { plate: 'Z' } }),
        makeLead({ id: 'l2', company_name: 'Alpha Co', class_b_custom_fields: { plate: 'A' } }),
      ];
      render(<LeadsDataGrid leads={leads} context={ctx()} onRowClick={vi.fn()} dataLayerColumns={COLUMNS} />);
      // When sorting by Next Follow-up (non Class B key, not in the comparator switch)
      fireEvent.click(screen.getByText('Next Follow-up'));
      // Then
      expect(order('Zeta Co', 'Alpha Co')).toBe(true);
    });
  });

  describe('Scenario: sorting a Class B column holding numbers and text', () => {
    it('then numbers compare numerically and mixed values compare as text, in both directions', () => {
      const cols: CrmCustomColumn[] = [{ key: 'units', label: 'Units', fieldType: 'number', filterable: true, sortable: true }];
      const leads = [
        makeLead({ id: 'l1', company_name: 'Ten Co', class_b_custom_fields: { units: 10 } }),
        makeLead({ id: 'l2', company_name: 'Nine Co', class_b_custom_fields: { units: 9 } }),
        makeLead({ id: 'l3', company_name: 'Text Co', class_b_custom_fields: { units: 'many' } }),
      ];
      render(<LeadsDataGrid leads={leads} context={ctx()} onRowClick={vi.fn()} dataLayerColumns={cols} />);
      // When ascending
      fireEvent.click(screen.getByText('Units'));
      // Then 9 before 10 (numeric, not lexical) and "many" after the digits
      expect(order('Nine Co', 'Ten Co')).toBe(true);
      expect(order('Ten Co', 'Text Co')).toBe(true);
      // When descending
      fireEvent.click(screen.getByText('Units'));
      expect(order('Text Co', 'Ten Co')).toBe(true);
      expect(order('Ten Co', 'Nine Co')).toBe(true);
    });
  });
});
