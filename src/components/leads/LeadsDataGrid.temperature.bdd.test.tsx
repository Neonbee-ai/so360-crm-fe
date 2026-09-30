import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LeadsDataGrid, GridContext } from './LeadsDataGrid';
import type { Lead } from '../../types/crm';

/**
 * Feature: Hot / Warm / Cold badge in the leads grid (RE plan E §20).
 * The badge sits next to the score bar only when the page turns
 * `showTemperature` on (flag `submodule:crm:re_lead_temperature`).
 */

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

const USERS = [{ id: 'u1', full_name: 'Alice Smith', email: 'alice@co.com' }];

const makeLead = (over: Partial<Lead> = {}): Lead => ({
  id: 'lead-1',
  company_name: 'Acme Corp',
  contact_name: 'Jane Doe',
  contact_email: 'jane@acme.com',
  source: 'Website',
  status: 'New',
  owner: USERS[0],
  created_at: '2024-01-15T10:00:00Z',
  activities: [],
  notes: [],
  custom_fields: {},
  auto_score: 72,
  ...over,
} as Lead);

const ctx = (over: Partial<GridContext> = {}): GridContext => ({
  users: USERS,
  leadStages: [{ id: 'new', name: 'New' }],
  canUpdate: true,
  canDelete: true,
  onOwnerChange: vi.fn(),
  onStatusChange: vi.fn(),
  onDelete: vi.fn(),
  onOpen: vi.fn(),
  formatDate: (d) => new Date(d).toLocaleDateString(),
  onInlineEdit: vi.fn(),
  ...over,
});

describe('Given the leads grid score column', () => {
  it('When temperature is on and the lead is banded, Then the badge shows beside the score', () => {
    render(
      <LeadsDataGrid
        leads={[makeLead({ temperature: 'warm', temperature_score: 55 })]}
        context={ctx({ showTemperature: true })}
        onRowClick={vi.fn()}
      />,
    );
    const badge = screen.getByTestId('lead-temperature-badge');
    expect(badge).toHaveAttribute('data-temperature', 'warm');
    expect(badge).toHaveAttribute('title', 'Warm lead — temperature 55/100');
    expect(screen.getByText('72')).toBeDefined();
  });

  it('When temperature is off, Then only the score is shown', () => {
    render(
      <LeadsDataGrid
        leads={[makeLead({ temperature: 'hot', temperature_score: 90 })]}
        context={ctx()}
        onRowClick={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('lead-temperature-badge')).toBeNull();
    expect(screen.getByText('72')).toBeDefined();
  });

  it('When temperature is on but the lead has no band yet, Then no badge is shown', () => {
    render(
      <LeadsDataGrid leads={[makeLead({ temperature: null })]} context={ctx({ showTemperature: true })} onRowClick={vi.fn()} />,
    );
    expect(screen.queryByTestId('lead-temperature-badge')).toBeNull();
  });
});
