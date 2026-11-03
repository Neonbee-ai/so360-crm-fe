import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Lead } from '../../types/crm';

const shell = vi.hoisted(() => ({ value: {} as any }));
vi.mock('@so360/shell-context', async (orig) => ({
  ...(await orig<any>()),
  useShellBridge: () => shell.value,
}));

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});
vi.mock('../../utils/formatters', () => ({
  useCRMFormatters: () => ({ formatDate: (d: string) => d, formatCurrency: (v: number) => `$${v}` }),
}));

import { LeadsDataGrid, type GridContext } from './LeadsDataGrid';
import { leadIcpScore } from '../../utils/icpFit';

const flag = (on: boolean) => ({
  effectiveFlagsLoaded: true,
  isFeatureEnabled: (k: string) => on && k === 'submodule:crm:icp_manager',
});

const lead = (id: string, over: Partial<Lead> = {}): Lead =>
  ({
    id, company_name: `Co ${id}`, first_name: 'A', last_name: 'B', contact_name: 'A B',
    contact_email: 'a@b.com', status: 'new', created_at: '2026-01-01T00:00:00Z', activities: [], notes: [],
    ...over,
  }) as Lead;

const ctx = (): GridContext => ({
  users: [], leadStages: [{ id: 'new', name: 'New' }] as any, canUpdate: true, canDelete: true,
  onOwnerChange: vi.fn(), onStatusChange: vi.fn(), onDelete: vi.fn(), onOpen: vi.fn(),
  formatDate: (d: string) => d, onInlineEdit: vi.fn(),
});

beforeEach(() => { localStorage.clear(); shell.value = flag(true); });

describe('Feature: ICP Fit column in the lead list', () => {
  it('Given the ICP flag is on and a scored lead / Then the row shows score, band chip and ICP name', () => {
    render(<LeadsDataGrid leads={[lead('1', { custom_fields: { icp_score: 72, icp_name: 'Enterprise CTOs' } })]} context={ctx()} onRowClick={vi.fn()} />);
    expect(screen.getByTestId('icp-fit-cell-score').textContent).toBe('72');
    expect(screen.getByTestId('icp-fit-cell-band').textContent).toBe('Good fit');
    expect(screen.getByTestId('icp-fit-cell-name').textContent).toBe('Enterprise CTOs');
  });

  it.each([[85, 'Excellent fit'], [60, 'Good fit'], [40, 'Fair fit'], [39, 'Not a fit']])(
    'Given a score of %s / Then the band chip reads %s',
    (score, label) => {
      render(<LeadsDataGrid leads={[lead('1', { score })]} context={ctx()} onRowClick={vi.fn()} />);
      expect(screen.getByTestId('icp-fit-cell-band').textContent).toBe(label);
    },
  );

  it('Given a lead with no ICP score / Then the cell shows a dash and no chip', () => {
    render(<LeadsDataGrid leads={[lead('1')]} context={ctx()} onRowClick={vi.fn()} />);
    expect(screen.queryByTestId('icp-fit-cell')).toBeNull();
  });

  it('Given the ICP flag is off / Then no Fit column header or cell is rendered', () => {
    shell.value = flag(false);
    render(<LeadsDataGrid leads={[lead('1', { score: 90 })]} context={ctx()} onRowClick={vi.fn()} />);
    expect(screen.queryByTestId('sort-icp_fit')).toBeNull();
    expect(screen.queryByTestId('icp-fit-cell')).toBeNull();
  });

  it('Given two scored leads / When the Fit header is clicked / Then rows sort ascending by score, unscored first', () => {
    render(<LeadsDataGrid leads={[lead('hi', { score: 90 }), lead('none'), lead('lo', { score: 10 })]} context={ctx()} onRowClick={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sort-icp_fit'));
    expect(screen.getByTestId('sort-icp_fit')).toHaveAttribute('aria-sort', 'ascending');
    const names = screen.getAllByText(/^Co /).map((n) => n.textContent);
    expect(names).toEqual(['Co none', 'Co lo', 'Co hi']);
  });
});

describe('leadIcpScore', () => {
  it('prefers meta icp_score over score, clamps and rounds, and returns null when absent', () => {
    expect(leadIcpScore({ score: 10, custom_fields: { icp_score: '72.6' } })).toBe(73);
    expect(leadIcpScore({ score: 140 })).toBe(100);
    expect(leadIcpScore({ custom_fields: { icp_score: 'x' } })).toBeNull();
    expect(leadIcpScore({})).toBeNull();
  });
});
