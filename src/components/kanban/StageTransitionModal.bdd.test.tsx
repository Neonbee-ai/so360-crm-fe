import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

import { StageTransitionModal } from './StageTransitionModal';

const deal = { id: 'd1', name: 'Acme Proposal', value: 10000 } as any;

describe('StageTransitionModal', () => {
  describe('Given no deal is provided', () => {
    it('When rendered with deal=null / Then renders nothing', () => {
      const { container } = render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={null} newStage="Won" />,
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Given the modal is closed', () => {
    it('When isOpen is false / Then does not show the modal', () => {
      const { container } = render(
        <StageTransitionModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Qualified" />,
      );
      expect(container.querySelector('[data-testid="modal"]')).toBeNull();
    });
  });

  describe('Given a regular stage transition', () => {
    it('When rendered / Then shows "Move to {stage}" title', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Qualified" />,
      );
      expect(screen.getByText(/move to qualified/i)).toBeInTheDocument();
    });

    it('When rendered / Then shows the deal name', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Negotiation" />,
      );
      expect(screen.getByText('Acme Proposal')).toBeInTheDocument();
    });

    it('When rendered / Then does not show a reason textarea', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Proposal" />,
      );
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('When submitted / Then calls onConfirm with empty reason and closes', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      render(
        <StageTransitionModal isOpen={true} onClose={onClose} onConfirm={onConfirm} deal={deal} newStage="Proposal" />,
      );
      fireEvent.submit(document.querySelector('form')!);
      expect(onConfirm).toHaveBeenCalledWith('');
      expect(onClose).toHaveBeenCalled();
    });

    it('When cancel button is clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(
        <StageTransitionModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} deal={deal} newStage="Proposal" />,
      );
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given a Won stage transition', () => {
    it('When rendered / Then shows "Close Deal: Won" title', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />,
      );
      expect(screen.getByText(/close deal: won/i)).toBeInTheDocument();
    });

    it('When rendered / Then shows the reason textarea', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />,
      );
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('When a reason is typed and submitted / Then calls onConfirm with that reason', async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} deal={deal} newStage="Won" />,
      );
      await user.type(screen.getByRole('textbox'), 'Client signed contract');
      fireEvent.submit(document.querySelector('form')!);
      expect(onConfirm).toHaveBeenCalledWith('Client signed contract');
    });
  });

  describe('Given a Lost stage transition', () => {
    it('When rendered / Then shows "Close Deal: Lost" title', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Lost" />,
      );
      expect(screen.getByText(/close deal: lost/i)).toBeInTheDocument();
    });

    it('When rendered / Then shows the reason label for Lost', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Lost" />,
      );
      expect(screen.getByText(/reason for lost/i)).toBeInTheDocument();
    });

    it('When rendered / Then the reason textarea is marked required', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Lost" />,
      );
      expect(screen.getByRole('textbox')).toHaveAttribute('required');
    });

    it('When a reason is typed and submitted / Then calls onConfirm with that reason', async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} deal={deal} newStage="Lost" />,
      );
      await user.type(screen.getByRole('textbox'), 'No response from client');
      fireEvent.submit(document.querySelector('form')!);
      expect(onConfirm).toHaveBeenCalledWith('No response from client');
    });
  });

  describe('Given the reason field — required validation', () => {
    it('Given Won stage / When rendered with empty textarea / Then the field is invalid (required)', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />,
      );
      expect(screen.getByRole('textbox')).toBeInvalid();
    });

    it('Given Lost stage / When rendered with empty textarea / Then the field is invalid (required)', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Lost" />,
      );
      expect(screen.getByRole('textbox')).toBeInvalid();
    });

    it('Given Won stage / When a reason is typed / Then the field becomes valid', async () => {
      const user = userEvent.setup();
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />,
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInvalid();
      await user.type(textarea, 'Signed contract');
      expect(textarea).toBeValid();
    });

    it('Given a regular stage / When rendered / Then there is no required textarea', () => {
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Negotiation" />,
      );
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Given state management — reason field reset', () => {
    it('Given a reason was typed / When form is submitted / Then the reason field resets to empty', async () => {
      const user = userEvent.setup();
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />,
      );
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Budget cut');
      expect(textarea).toHaveValue('Budget cut');
      fireEvent.submit(document.querySelector('form')!);
      expect(textarea).toHaveValue('');
    });

    it('Given Won modal / When cancel is clicked / Then onConfirm is NOT called', () => {
      const onConfirm = vi.fn();
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} deal={deal} newStage="Won" />,
      );
      fireEvent.click(screen.getByText('Cancel'));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('Given Lost modal / When cancel is clicked / Then onConfirm is NOT called', () => {
      const onConfirm = vi.fn();
      render(
        <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} deal={deal} newStage="Lost" />,
      );
      fireEvent.click(screen.getByText('Cancel'));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
