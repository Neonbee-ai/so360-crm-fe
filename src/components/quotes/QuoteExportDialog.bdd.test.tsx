import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import QuoteExportDialog from './QuoteExportDialog';

const QUOTES: any[] = [
  { id: '1', quote_number: 'Q-001', status: 'draft', customer_name: 'Acme', created_at: '2026-06-01T00:00:00Z', created_by: { id: 'u1', full_name: 'Ann', email: 'a@x.com' } },
  { id: '2', quote_number: 'Q-002', status: 'approved', customer_name: 'Beta', created_at: '2026-06-15T00:00:00Z', created_by: { id: 'u2', full_name: 'Bob', email: 'b@x.com' } },
];
const name = (q: any) => q.customer_name ?? '';

const renderDialog = (onExport = vi.fn()) =>
  render(<QuoteExportDialog quotes={QUOTES} customerName={name} onClose={vi.fn()} onExport={onExport} />);

describe('QuoteExportDialog (Pulse 222d6d31)', () => {
  it('Given the dialog opens / When Export is confirmed with the default / Then every quote is exported', () => {
    const onExport = vi.fn();
    renderDialog(onExport);
    fireEvent.click(screen.getByTestId('quote-export-confirm'));
    expect(onExport).toHaveBeenCalledWith(QUOTES);
  });

  it('Given Export filtered is chosen / When no filter is set / Then export is disabled with guidance', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/export filtered quotes/i));
    expect(screen.getByTestId('quote-export-confirm')).toBeDisabled();
    expect(screen.getByText(/choose at least one filter/i)).toBeInTheDocument();
  });

  it('Given a customer filter / When it matches one quote / Then only that quote is exported', () => {
    const onExport = vi.fn();
    renderDialog(onExport);
    fireEvent.click(screen.getByLabelText(/export filtered quotes/i));
    fireEvent.change(screen.getByLabelText(/^customer/i), { target: { value: 'beta' } });
    fireEvent.click(screen.getByTestId('quote-export-confirm'));
    expect(onExport).toHaveBeenCalledWith([QUOTES[1]]);
  });

  it('Given a filter that matches nothing / When shown / Then a no-match message replaces the export', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/export filtered quotes/i));
    fireEvent.change(screen.getByLabelText(/^customer/i), { target: { value: 'zzz' } });
    expect(screen.getByTestId('quote-export-empty')).toBeInTheDocument();
    expect(screen.getByTestId('quote-export-confirm')).toBeDisabled();
  });

  it('Given From is after To / When shown / Then the range error blocks export', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/export filtered quotes/i));
    fireEvent.change(screen.getByLabelText(/created from/i), { target: { value: '2026-07-02' } });
    fireEvent.change(screen.getByLabelText(/created to/i), { target: { value: '2026-07-01' } });
    expect(screen.getByText(/cannot be later/i)).toBeInTheDocument();
    expect(screen.getByTestId('quote-export-confirm')).toBeDisabled();
  });
});
