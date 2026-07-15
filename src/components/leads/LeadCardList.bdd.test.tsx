import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LeadCardList from './LeadCardList';
import type { Lead } from '../../types/crm';

const makeLead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: 'l1',
    company_name: 'Acme Corp',
    contact_name: 'Jane Doe',
    contact_email: 'jane@acme.com',
    phone: '555-0100',
    source: 'Website',
    status: 'New',
    owner: { id: 'u1', full_name: 'Alice', email: 'a@a.com' },
    auto_score: 72,
    created_at: '2026-01-01T00:00:00Z',
    activities: [],
    notes: [],
    ...(over as object),
  } as Lead);

const setup = (leads: Lead[], selected: string[] = []) => {
  const onToggleSelect = vi.fn();
  const onRowClick = vi.fn();
  render(
    <LeadCardList
      leads={leads}
      selectedIds={new Set(selected)}
      onToggleSelect={onToggleSelect}
      onRowClick={onRowClick}
    />,
  );
  return { onToggleSelect, onRowClick };
};

describe('LeadCardList', () => {
  it('renders a card per lead with company, contact and score', () => {
    setup([makeLead(), makeLead({ id: 'l2', company_name: 'Beta LLC' })]);
    expect(screen.getByTestId('lead-card-l1')).toBeInTheDocument();
    expect(screen.getByTestId('lead-card-l2')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('opens a lead when its card is tapped', () => {
    const { onRowClick } = setup([makeLead()]);
    fireEvent.click(screen.getByTestId('lead-card-l1'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
  });

  it('toggles selection via the checkbox without opening the lead', () => {
    const { onToggleSelect, onRowClick } = setup([makeLead()]);
    fireEvent.click(within(screen.getByTestId('lead-card-l1')).getByLabelText('Select lead'));
    expect(onToggleSelect).toHaveBeenCalledWith('l1');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('tapping the email link does not open the lead', () => {
    const { onRowClick } = setup([makeLead()]);
    fireEvent.click(screen.getByText('jane@acme.com'));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('reflects the selected state', () => {
    setup([makeLead()], ['l1']);
    const card = screen.getByTestId('lead-card-l1');
    // Selected card carries the accent border/background class.
    expect(card.className).toContain('border-blue-500/50');
  });

  it('shows an empty state when there are no leads', () => {
    setup([]);
    expect(screen.getByTestId('lead-card-list')).toHaveTextContent(/no leads found/i);
  });
});
