import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Modal } from './Modal';

describe('Modal', () => {
  describe('Given the modal is open', () => {
    it('When rendered / Then shows the modal title', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Confirm Action"><p>Body text</p></Modal>);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('When rendered / Then shows the modal children content', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Title"><p>Modal content here</p></Modal>);
      expect(screen.getByText('Modal content here')).toBeInTheDocument();
    });

    it('When the close button is clicked / Then calls onClose', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<Modal isOpen={true} onClose={onClose} title="Title"><p>Content</p></Modal>);
      await user.click(screen.getByRole('button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('When the backdrop overlay is clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      const { container } = render(<Modal isOpen={true} onClose={onClose} title="Title"><p>Content</p></Modal>);
      const backdrop = container.querySelector('.bg-slate-950\\/80');
      expect(backdrop).toBeTruthy();
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('When content area is clicked / Then does not call onClose', () => {
      const onClose = vi.fn();
      render(<Modal isOpen={true} onClose={onClose} title="Title"><p>Inner content</p></Modal>);
      fireEvent.click(screen.getByText('Inner content'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('When rendered with custom children / Then renders them inside the modal', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Form Modal">
          <input data-testid="modal-input" placeholder="Enter value" />
        </Modal>,
      );
      expect(screen.getByTestId('modal-input')).toBeInTheDocument();
    });
  });

  describe('Given the modal is closed', () => {
    it('When rendered with isOpen=false / Then renders nothing', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()} title="Hidden Modal"><p>Not visible</p></Modal>,
      );
      expect(container.firstChild).toBeNull();
    });

    it('When rendered with isOpen=false / Then does not show the title', () => {
      render(<Modal isOpen={false} onClose={vi.fn()} title="Hidden Title"><p>x</p></Modal>);
      expect(screen.queryByText('Hidden Title')).not.toBeInTheDocument();
    });
  });

  describe('Given a custom title is provided', () => {
    it('When rendered / Then shows exactly that title text', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Delete Confirmation"><span /></Modal>);
      expect(screen.getByText('Delete Confirmation')).toBeInTheDocument();
    });
  });
});
