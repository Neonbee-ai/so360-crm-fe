import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) => isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

import { StageTransitionModal } from './StageTransitionModal';

describe('Given StageTransitionModal', () => {
  const deal = { id: 'd1', name: 'Test Deal', value: 5000, owner: { id: 'u1', full_name: 'Test' } } as any;

  it('When action / Then returns null when deal is null', () => {
    const { container } = render(
      <StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={null} newStage="Won" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('When action / Then renders modal for normal stage transition', () => {
    render(<StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Qualified" />);
    expect(screen.getByText(/move to qualified/i)).toBeInTheDocument();
    expect(screen.getByText('Test Deal')).toBeInTheDocument();
  });

  it('When action / Then renders special close modal for Won stage', () => {
    render(<StageTransitionModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />);
    expect(screen.getByText(/close deal: won/i)).toBeInTheDocument();
  });

  it('When action / Then calls onConfirm on form submit', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<StageTransitionModal isOpen={true} onClose={onClose} onConfirm={onConfirm} deal={deal} newStage="Qualified" />);
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
      expect(onConfirm).toHaveBeenCalledWith('');
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('When action / Then does not render when closed', () => {
    const { container } = render(
      <StageTransitionModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} deal={deal} newStage="Won" />,
    );
    expect(container.querySelector('[data-testid="modal"]')).toBeNull();
  });
});
