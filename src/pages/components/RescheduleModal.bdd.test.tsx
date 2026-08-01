import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RescheduleModal } from './RescheduleModal';

describe('RescheduleModal', () => {
  describe('Given the reschedule modal is open', () => {
    it('When rendered / Then shows the Reschedule Task heading', () => {
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
      expect(screen.getByText('Reschedule Task')).toBeInTheDocument();
    });

    it('When rendered / Then shows the New Due Date label', () => {
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
      expect(screen.getByText('New Due Date')).toBeInTheDocument();
    });

    it('When rendered / Then pre-fills the date input from currentDate', () => {
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
      const input = screen.getByDisplayValue('2024-06-15');
      expect(input).toBeInTheDocument();
    });

    it('When the Reschedule button is shown / Then it is visible', () => {
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
      expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    });
  });

  describe('Given the user closes the modal', () => {
    it('When the X close button is clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={onClose} onConfirm={vi.fn()} />);
      const closeBtn = screen.getByTestId('icon-X').closest('button')!;
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });

    it('When the Cancel button is clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={onClose} onConfirm={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given modal size constraint', () => {
    it('When rendered / Then modal panel has max-h-[90vh] and overflow-y-auto', () => {
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
      const panels = Array.from(document.querySelectorAll('div')).filter(
        el => el.className.includes('max-h-[90vh]'),
      );
      expect(panels.length).toBeGreaterThan(0);
      expect(panels[0].className).toContain('overflow-y-auto');
    });
  });

  describe('Given the user submits a new date', () => {
    it('When the form is submitted / Then calls onConfirm with the selected date', () => {
      const onConfirm = vi.fn();
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={onConfirm} />);
      fireEvent.submit(document.querySelector('form')!);
      expect(onConfirm).toHaveBeenCalledWith('2024-06-15');
    });

    it('When the user changes the date and submits / Then calls onConfirm with the new date', () => {
      const onConfirm = vi.fn();
      render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={onConfirm} />);
      const dateInput = screen.getByDisplayValue('2024-06-15');
      fireEvent.change(dateInput, { target: { value: '2024-07-20' } });
      fireEvent.submit(document.querySelector('form')!);
      expect(onConfirm).toHaveBeenCalledWith('2024-07-20');
    });
  });
});
