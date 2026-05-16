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
  });
});
