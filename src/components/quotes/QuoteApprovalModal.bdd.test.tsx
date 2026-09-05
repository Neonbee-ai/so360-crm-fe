import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { QuoteApprovalModal } from './QuoteApprovalModal';

const mockGetApprovers = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getApprovers: (...a: any[]) => mockGetApprovers(...a),
  },
}));

const mockQuote: any = {
  id: 'q-100',
  quote_number: 'Q-2026-001',
  title: 'Hardware Upgrade',
  total_amount: 25000,
};

const candidates = [
  {
    user_id: 'user-submitter',
    full_name: 'Me Submitter',
    email: 'me@example.com',
    job_title: 'Account Exec',
    department_name: 'Sales',
  },
  {
    user_id: 'user-manager',
    full_name: 'Jane Manager',
    email: 'jane@example.com',
    job_title: 'Sales Manager',
    department_name: 'Sales',
  },
  {
    user_id: 'user-finance',
    full_name: 'Frank Finance',
    email: 'frank@example.com',
    job_title: 'Finance Director',
    department_name: 'Finance',
  },
];

describe('QuoteApprovalModal BDD Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApprovers.mockResolvedValue(candidates);
  });

  it('Given modal is closed, When rendered, Then nothing is shown', () => {
    const { container } = render(
      <QuoteApprovalModal
        quote={mockQuote}
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('Given modal opens, When rendered, Then loads approvers and shows quote summary', async () => {
    render(
      <QuoteApprovalModal
        quote={mockQuote}
        isOpen={true}
        currentUserId="user-submitter"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Submit Quote for Approval')).toBeInTheDocument();
      expect(screen.getByText('Q-2026-001')).toBeInTheDocument();
      expect(mockGetApprovers).toHaveBeenCalled();
    });
  });

  it('Given candidate list, When submitter attempts self-approval, Then blocks selection with error message', async () => {
    render(
      <QuoteApprovalModal
        quote={mockQuote}
        isOpen={true}
        currentUserId="user-submitter"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search by name, email, department/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Submitter' } });

    await waitFor(() => {
      expect(screen.getByText('Me Submitter')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Me Submitter'));

    await waitFor(() => {
      expect(screen.getByText(/self-approval is not permitted/i)).toBeInTheDocument();
    });
  });

  it('Given multiple reviewers selected, When Send for Approval is clicked, Then invokes onSubmit with reviewer IDs', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <QuoteApprovalModal
        quote={mockQuote}
        isOpen={true}
        currentUserId="user-submitter"
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByPlaceholderText(/search by name, email, department/i);

    // Select Jane
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Jane' } });
    await waitFor(() => screen.getByText('Jane Manager'));
    fireEvent.click(screen.getByText('Jane Manager'));

    // Select Frank
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Frank' } });
    await waitFor(() => screen.getByText('Frank Finance'));
    fireEvent.click(screen.getByText('Frank Finance'));

    // Add notes
    const notesArea = screen.getByPlaceholderText(/add context or justification/i);
    fireEvent.change(notesArea, { target: { value: 'Special discount approval' } });

    const submitBtn = screen.getByRole('button', { name: /send for approval/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        ['user-manager', 'user-finance'],
        'Special discount approval'
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('Given reviewer selection, When removing a chip, Then reviewer is unselected', async () => {
    render(
      <QuoteApprovalModal
        quote={mockQuote}
        isOpen={true}
        currentUserId="user-submitter"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/search by name, email, department/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Jane' } });
    await waitFor(() => screen.getByText('Jane Manager'));
    fireEvent.click(screen.getByText('Jane Manager'));

    await waitFor(() => {
      expect(screen.getByText('Jane Manager')).toBeInTheDocument();
    });

    // Remove Jane
    const removeBtn = screen.getByRole('button', { name: /remove jane manager/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /remove jane manager/i })).not.toBeInTheDocument();
    });
  });
});
