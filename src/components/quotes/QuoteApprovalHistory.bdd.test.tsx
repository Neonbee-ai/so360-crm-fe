import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QuoteApprovalHistory, ApprovalRequestRecord } from './QuoteApprovalHistory';

const sampleHistory: ApprovalRequestRecord[] = [
  {
    id: 'req-cycle-2',
    quote_id: 'q-100',
    requested_by: 'user-submitter',
    requested_at: '2026-09-02T10:00:00Z',
    status: 'pending',
    total_amount_snapshot: 30000,
    notes: 'Resubmission with reduced discount',
    approvers: [
      {
        id: 'app-2-1',
        approver_user_id: 'user-approver-1',
        approver_name: 'Alice Director',
        status: 'approved',
        decision_at: '2026-09-02T11:00:00Z',
        notes: 'Approved revised quote',
      },
      {
        id: 'app-2-2',
        approver_user_id: 'user-approver-2',
        approver_name: 'Bob VP',
        status: 'pending',
      },
    ],
  },
  {
    id: 'req-cycle-1',
    quote_id: 'q-100',
    requested_by: 'user-submitter',
    requested_at: '2026-09-01T09:00:00Z',
    status: 'rejected',
    total_amount_snapshot: 35000,
    notes: 'Initial proposal',
    approvers: [
      {
        id: 'app-1-1',
        approver_user_id: 'user-approver-1',
        approver_name: 'Alice Director',
        status: 'rejected',
        decision_at: '2026-09-01T10:00:00Z',
        notes: 'Discount exceeds policy limits',
      },
    ],
  },
];

describe('QuoteApprovalHistory BDD Specifications', () => {
  it('Given empty history, When rendered, Then returns null without crashing', () => {
    const { container } = render(
      <QuoteApprovalHistory history={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('Given approval history with 2 cycles, When rendered, Then displays cycles and expands latest cycle', () => {
    render(
      <QuoteApprovalHistory
        history={sampleHistory}
        currentRequestId="req-cycle-2"
        formatDate={(d) => d}
        formatCurrency={(v) => `$${v}`}
      />
    );

    expect(screen.getByText('Approval History & Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('2 Cycles')).toBeInTheDocument();
    expect(screen.getByText('Cycle 2')).toBeInTheDocument();
    expect(screen.getByText('Cycle 1')).toBeInTheDocument();

    // Cycle 2 details are visible by default
    expect(screen.getByText('Resubmission with reduced discount')).toBeInTheDocument();
    expect(screen.getByText('Alice Director')).toBeInTheDocument();
    expect(screen.getByText('Bob VP')).toBeInTheDocument();
  });

  it('Given collapsed past cycle, When clicked, Then toggles expansion to show decision notes', () => {
    render(
      <QuoteApprovalHistory
        history={sampleHistory}
        currentRequestId="req-cycle-2"
        formatDate={(d) => d}
        formatCurrency={(v) => `$${v}`}
      />
    );

    // Initial cycle notes from Cycle 1 shouldn't be visible yet
    expect(screen.queryByText('Discount exceeds policy limits')).not.toBeInTheDocument();

    // Click on Cycle 1 header to expand
    fireEvent.click(screen.getByText('Cycle 1'));

    // Now Cycle 1 details and rejection notes should be visible
    expect(screen.getByText('Discount exceeds policy limits')).toBeInTheDocument();
    expect(screen.getByText('Initial proposal')).toBeInTheDocument();
  });
});
