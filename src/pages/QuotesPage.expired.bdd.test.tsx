import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QuoteStatusCell } from './QuotesPage';

const base: any = { id: 'q1', quote_number: 'Q-1', deal_id: 'd1', lines: [] };

describe('QuoteStatusCell expiry (BDD)', () => {
  it('Given an open quote the server flags as lapsed, When rendered, Then it shows Expired', () => {
    render(<QuoteStatusCell quote={{ ...base, status: 'approved', effective_status: 'expired', is_expired: true }} isActionLoading={false} onAction={vi.fn()} />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });
  it('Given no effective_status, When rendered, Then the stored status is used', () => {
    render(<QuoteStatusCell quote={{ ...base, status: 'approved' }} isActionLoading={false} onAction={vi.fn()} />);
    expect(screen.getByText('Approved')).toBeTruthy();
  });
});
