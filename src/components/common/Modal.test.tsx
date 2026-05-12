import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

// Mock lucide-react
describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <p>Modal content</p>,
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<Modal {...defaultProps} title="My Custom Title" />);
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Modal {...defaultProps}>
        <div data-testid="custom-child">Custom child</div>
      </Modal>
    );
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal {...defaultProps} onClose={onClose} />);

    // The backdrop is the first child div with the bg-slate-950 class
    const backdrop = container.querySelector('.bg-slate-950\\/80');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when modal content area is clicked', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Modal content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the X icon in close button', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByTestId('icon-X')).toBeInTheDocument();
  });
});
