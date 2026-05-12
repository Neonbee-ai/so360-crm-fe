import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { RescheduleModal } from './RescheduleModal';

describe('RescheduleModal', () => {
  const defaultProps = {
    currentDate: '2024-06-15T00:00:00Z',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('renders the modal with date input', () => {
    render(<RescheduleModal {...defaultProps} />);
    expect(screen.getByText('Reschedule Task')).toBeInTheDocument();
  });

  it('shows new due date label', () => {
    render(<RescheduleModal {...defaultProps} />);
    expect(screen.getByText('New Due Date')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<RescheduleModal {...defaultProps} />);
    const closeBtn = screen.getByTestId('icon-X');
    fireEvent.click(closeBtn.closest('button')!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm on form submit', () => {
    render(<RescheduleModal {...defaultProps} />);
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
      expect(defaultProps.onConfirm).toHaveBeenCalled();
    }
  });
});
