import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { QuoteApprovalModal } from './QuoteApprovalModal';

const mockGetApprovers = vi.fn();
vi.mock('../../services/crmService', () => ({
  crmService: { getApprovers: (...a: any[]) => mockGetApprovers(...a) },
}));

const quote: any = { id: 'q-100', quote_number: 'Q-1', total_amount: 100 };
const cands = [
  { user_id: 'me', full_name: 'Me Submitter', email: 'me@x.com', job_title: 'AE' },
  { user_id: 'jane', full_name: 'Jane Manager', email: 'jane@x.com', job_title: 'Manager' },
  { user_id: 'frank', full_name: 'Frank Finance', email: 'frank@x.com', job_title: 'Director' },
];

const setup = async (over: any = {}) => {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<QuoteApprovalModal quote={quote} isOpen currentUserId="me" onClose={onClose} onSubmit={onSubmit} {...over} />);
  await waitFor(() => expect(mockGetApprovers).toHaveBeenCalled());
  return { onClose, onSubmit };
};
const openDropdown = async () => {
  fireEvent.focus(screen.getByLabelText('Search approvers'));
  await screen.findByRole('button', { name: /Jane Manager/ });
};
const pick = async (name: RegExp) => {
  await openDropdown();
  fireEvent.click(screen.getByRole('button', { name }));
};
const sendBtn = () => screen.getByRole('button', { name: /Send for Approval|Sending/ });

describe('Feature QuoteApprovalModal Comb controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApprovers.mockResolvedValue(cands);
  });

  describe('Scenario footer buttons render', () => {
    it('Given the modal When open Then Cancel is a Comb secondary Button', async () => {
      await setup();
      const b = screen.getByRole('button', { name: 'Cancel' });
      expect(b).toHaveAttribute('data-comb', 'button');
      expect(b).toHaveAttribute('data-variant', 'secondary');
      expect(b).toHaveAttribute('type', 'button');
    });

    it('Given the modal When open Then Send is a Comb primary Button with label', async () => {
      await setup();
      expect(sendBtn()).toHaveAttribute('data-comb', 'button');
      expect(sendBtn()).toHaveAttribute('data-variant', 'primary');
      expect(sendBtn()).toHaveTextContent('Send for Approval');
    });
  });

  describe('Scenario disabled', () => {
    it('Given no approvers selected When open Then Send is disabled and click does not submit', async () => {
      const { onSubmit } = await setup();
      expect(sendBtn()).toBeDisabled();
      fireEvent.click(sendBtn());
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('Given an approver selected When chosen Then Send becomes enabled', async () => {
      await setup();
      await pick(/Jane Manager/);
      expect(sendBtn()).toBeEnabled();
    });

    it('Given the only approver removed When removed Then Send is disabled again', async () => {
      await setup();
      await pick(/Jane Manager/);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Jane Manager' }));
      expect(sendBtn()).toBeDisabled();
    });
  });

  describe('Scenario candidate rows', () => {
    it('Given the dropdown When opened Then each candidate is a Comb ghost Button', async () => {
      await setup();
      await openDropdown();
      const row = screen.getByRole('button', { name: /Jane Manager/ });
      expect(row).toHaveAttribute('data-comb', 'button');
      expect(row).toHaveAttribute('data-variant', 'ghost');
      expect(row).toHaveTextContent('Manager');
    });

    it('Given a candidate row When clicked Then it becomes a chip with a Comb IconButton remove and the dropdown closes', async () => {
      await setup();
      await pick(/Frank Finance/);
      const rm = screen.getByRole('button', { name: 'Remove Frank Finance' });
      expect(rm).toHaveAttribute('data-comb', 'icon-button');
      expect(rm).toHaveAttribute('data-size', 'sm');
      expect(screen.queryByRole('button', { name: /Jane Manager/ })).toBeNull();
    });

    it('Given a selected approver When listed Then they are excluded from candidates', async () => {
      await setup();
      await pick(/Frank Finance/);
      fireEvent.focus(screen.getByLabelText('Search approvers'));
      await screen.findByRole('button', { name: /Jane Manager/ });
      expect(screen.queryByRole("button", { name: /^Frank Finance/ })).toBeNull();
    });

    it('Given a query When typed Then candidates are filtered', async () => {
      await setup();
      fireEvent.change(screen.getByLabelText('Search approvers'), { target: { value: 'frank' } });
      await screen.findByRole('button', { name: /Frank Finance/ });
      expect(screen.queryByRole('button', { name: /Jane Manager/ })).toBeNull();
    });

    it('Given a query with no match When typed Then the empty message shows', async () => {
      await setup();
      fireEvent.change(screen.getByLabelText('Search approvers'), { target: { value: 'zzz' } });
      expect(await screen.findByText('No matching people found')).toBeInTheDocument();
    });

    it('Given no candidates at all When opened Then "No available approvers" shows', async () => {
      mockGetApprovers.mockResolvedValue([]);
      await setup();
      fireEvent.focus(screen.getByLabelText('Search approvers'));
      expect(await screen.findByText('No available approvers')).toBeInTheDocument();
    });

    it('Given the directory is loading When opened Then the loading message shows', async () => {
      mockGetApprovers.mockReturnValue(new Promise(() => {}));
      render(<QuoteApprovalModal quote={quote} isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
      fireEvent.focus(screen.getByLabelText('Search approvers'));
      expect(await screen.findByText('Loading people directory...')).toBeInTheDocument();
    });

    it('Given the directory API fails When opened Then an error banner shows', async () => {
      mockGetApprovers.mockRejectedValue(new Error('down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await setup();
      expect(await screen.findByText('Failed to load approvers directory')).toBeInTheDocument();
    });
  });

  describe('Scenario self-approval guard', () => {
    it('Given the self row When shown Then it is marked "You (Cannot approve)"', async () => {
      await setup();
      fireEvent.focus(screen.getByLabelText('Search approvers'));
      expect(await screen.findByText('You (Cannot approve)')).toBeInTheDocument();
    });

    it('Given the self row When clicked Then an error shows, no chip is added and the dropdown stays open', async () => {
      await setup();
      fireEvent.focus(screen.getByLabelText('Search approvers'));
      fireEvent.click(await screen.findByRole('button', { name: /Me Submitter/ }));
      expect(screen.getByText(/Self-approval is not permitted/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove Me Submitter/ })).toBeNull();
      expect(screen.getByRole('button', { name: /Jane Manager/ })).toBeInTheDocument();
      expect(sendBtn()).toBeDisabled();
    });

    it('Given a self error When another approver is picked Then the error clears', async () => {
      await setup();
      fireEvent.focus(screen.getByLabelText('Search approvers'));
      fireEvent.click(await screen.findByRole('button', { name: /Me Submitter/ }));
      fireEvent.click(screen.getByRole('button', { name: /Jane Manager/ }));
      expect(screen.queryByText(/Self-approval is not permitted/)).toBeNull();
    });
  });

  describe('Scenario Cancel and remove', () => {
    it('Given the modal When Cancel is clicked Then onClose is called', async () => {
      const { onClose } = await setup();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Given two approvers When one is removed Then only that chip goes away', async () => {
      await setup();
      await pick(/Jane Manager/);
      await pick(/Frank Finance/);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Jane Manager' }));
      expect(screen.queryByRole('button', { name: 'Remove Jane Manager' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Remove Frank Finance' })).toBeInTheDocument();
    });
  });

  describe('Scenario submit', () => {
    it('Given approvers and a note When Send is clicked Then onSubmit gets ids and trimmed note then closes', async () => {
      const { onSubmit, onClose } = await setup();
      await pick(/Jane Manager/);
      await pick(/Frank Finance/);
      fireEvent.change(screen.getByLabelText('Optional Note for Approvers'), { target: { value: '  please  ' } });
      fireEvent.click(sendBtn());
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(['jane', 'frank'], 'please'));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('Given a blank note When Send is clicked Then note is undefined', async () => {
      const { onSubmit } = await setup();
      await pick(/Jane Manager/);
      fireEvent.click(sendBtn());
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(['jane'], undefined));
    });

    it('Given a pending submit When sending Then label is Sending, Send and Cancel are disabled', async () => {
      let resolve: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
      await setup({ onSubmit });
      await pick(/Jane Manager/);
      fireEvent.click(sendBtn());
      await waitFor(() => expect(sendBtn()).toHaveTextContent('Sending...'));
      expect(sendBtn()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      resolve();
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    });

    it('Given onSubmit rejects with a message When Send is clicked Then the error shows, modal stays open, buttons re-enable', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Quote locked'));
      const { onClose } = await setup({ onSubmit });
      await pick(/Jane Manager/);
      fireEvent.click(sendBtn());
      expect(await screen.findByText('Quote locked')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(sendBtn()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    });

    it('Given onSubmit rejects without a message When Send is clicked Then the generic error shows', async () => {
      const onSubmit = vi.fn().mockRejectedValue({});
      await setup({ onSubmit });
      await pick(/Jane Manager/);
      fireEvent.click(sendBtn());
      expect(await screen.findByText('Failed to submit quote for approval')).toBeInTheDocument();
    });
  });

  describe('Scenario reopen', () => {
    it('Given a selection When the modal closes and reopens Then selection is cleared', async () => {
      const onClose = vi.fn(); const onSubmit = vi.fn();
      const { rerender } = render(<QuoteApprovalModal quote={quote} isOpen currentUserId="me" onClose={onClose} onSubmit={onSubmit} />);
      await waitFor(() => expect(mockGetApprovers).toHaveBeenCalled());
      await pick(/Jane Manager/);
      rerender(<QuoteApprovalModal quote={quote} isOpen={false} currentUserId="me" onClose={onClose} onSubmit={onSubmit} />);
      rerender(<QuoteApprovalModal quote={quote} isOpen currentUserId="me" onClose={onClose} onSubmit={onSubmit} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /Send for Approval/ })).toBeDisabled());
      expect(screen.queryByRole('button', { name: 'Remove Jane Manager' })).toBeNull();
    });
  });
});
