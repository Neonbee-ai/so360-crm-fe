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
      render(<Modal isOpen={true} onClose={onClose} title="Title"><p>Content</p></Modal>);
      // Modal renders via portal into document.body — query there
      const backdrop = document.body.querySelector('.bg-slate-950\\/80');
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

  describe('Given viewport-safety layout contract (overflow fix)', () => {
    const getOuter = () => document.body.querySelector('.fixed.inset-0.z-\\[600\\]') as HTMLElement;
    const getPanel = (outer: HTMLElement) =>
      Array.from(outer.children).find(el => !el.classList.contains('fixed')) as HTMLElement;

    it('When the modal is open / Then outer wrapper has overflow-y-auto so backdrop scrolls on tall viewports', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Overflow Guard"><p>content</p></Modal>);
      const outer = getOuter();
      expect(outer).not.toBeNull();
      expect(outer.className).toContain('overflow-y-auto');
    });

    it('When the modal is open / Then outer wrapper uses items-start (not items-center) to prevent top clipping', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Items Start"><p>content</p></Modal>);
      const outer = getOuter();
      expect(outer.className).toContain('items-start');
      expect(outer.className).not.toContain('items-center');
    });

    it('When the modal is open / Then outer wrapper is a flex container with justify-center', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Flex Center"><p>content</p></Modal>);
      const outer = getOuter();
      expect(outer.className).toContain('flex');
      expect(outer.className).toContain('justify-center');
    });

    it('When the modal is open / Then modal panel has my-auto for centering when content fits viewport', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="My Auto"><p>content</p></Modal>);
      const outer = getOuter();
      const panel = getPanel(outer);
      expect(panel).not.toBeNull();
      expect(panel.className).toContain('my-auto');
    });

    it('When the modal is open / Then modal panel has max-h constraint to cap height within viewport', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="MaxH Test"><p>content</p></Modal>);
      const outer = getOuter();
      const panel = getPanel(outer);
      expect(panel.className).toContain('max-h-');
    });

    it('When the modal is open / Then modal panel has overflow-hidden to clip internal content', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Clip Test"><p>content</p></Modal>);
      const outer = getOuter();
      const panel = getPanel(outer);
      expect(panel.className).toContain('overflow-hidden');
    });

    it('When the modal is open / Then body scroll zone has min-h-0 to allow flex shrinking', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="MinH Zero"><p>body</p></Modal>);
      const outer = getOuter();
      const panel = getPanel(outer);
      const scrollZone = panel.querySelector('.overflow-y-auto') as HTMLElement;
      expect(scrollZone).not.toBeNull();
      expect(scrollZone.className).toContain('min-h-0');
    });

    it('When the modal is open / Then inner scroll zone is a child of the panel, not the panel itself', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Internal Scroll"><p>body</p></Modal>);
      const outer = getOuter();
      const panel = getPanel(outer);
      const scrollZone = panel.querySelector('.overflow-y-auto');
      expect(scrollZone).not.toBeNull();
      expect(panel.className).not.toContain('overflow-y-auto');
    });

    it('When the modal header is rendered / Then it is a shrink-0 child so it never scrolls away', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Header Sticky"><p>body</p></Modal>);
      const header = screen.getByText('Header Sticky').closest('div');
      expect(header).not.toBeNull();
      expect(header!.className).toContain('shrink-0');
    });
  });

  describe('Given the Shell-FE z-index layering requirement', () => {
    it('When the modal is open / Then the overlay renders into document.body via portal', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Portal Test"><p>content</p></Modal>,
      );
      // Container itself has no modal DOM — content is portalled to body
      expect(container.firstChild).toBeNull();
      expect(document.body.querySelector('[class*="fixed inset-0"]')).toBeTruthy();
    });

    it('When the modal is open / Then the overlay has z-[600] to sit above the Shell NavBar (z-500)', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Z-index Test"><p>content</p></Modal>);
      const overlay = document.body.querySelector('[class*="z-\\[600\\]"]');
      expect(overlay).toBeTruthy();
    });

    it('When the modal opens / Then body scroll is locked', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="Scroll Lock"><p>content</p></Modal>);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('When the modal closes / Then body scroll is restored', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Scroll Restore"><p>content</p></Modal>,
      );
      expect(document.body.style.overflow).toBe('hidden');
      rerender(<Modal isOpen={false} onClose={vi.fn()} title="Scroll Restore"><p>content</p></Modal>);
      expect(document.body.style.overflow).toBe('');
    });

    it('When the modal is closed / Then nothing is portalled to document.body', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()} title="Closed Portal"><p>content</p></Modal>,
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByText('Closed Portal')).not.toBeInTheDocument();
    });
  });
});
