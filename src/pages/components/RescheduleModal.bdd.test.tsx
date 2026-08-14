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

/**
 * Rescheduling used to move only the calendar day, so a task pushed from
 * "20 Aug 2:30 PM" to the 22nd came back at midnight — and every reminder card
 * then read "5:30 AM", the local rendering of that UTC midnight.
 */
describe('Given a task is rescheduled', () => {
  const timeInput = () => document.querySelector('input[type="time"]') as HTMLInputElement;
  const dateInput = () => document.querySelector('input[type="date"]') as HTMLInputElement;

  it('When the modal opens / Then a New Due Time field is offered alongside the date', () => {
    render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/new due time/i)).toBeInTheDocument();
    expect(timeInput()).toBeInTheDocument();
  });

  it('Given a task with a time / When the modal opens / Then both halves are pre-filled', () => {
    const saved = new Date('2024-06-15T14:30:00').toISOString();
    render(<RescheduleModal currentDate={saved} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(dateInput().value).toBe('2024-06-15');
    expect(timeInput().value).toBe('14:30');
  });

  it('Given a date-only task / When the modal opens / Then the time stays empty rather than showing midnight', () => {
    render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(timeInput().value).toBe('');
  });

  it('When only the date is changed / Then a bare calendar date is confirmed, with no invented time', () => {
    const onConfirm = vi.fn();
    render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(dateInput(), { target: { value: '2024-06-22' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onConfirm).toHaveBeenCalledWith('2024-06-22');
  });

  it('When a time is chosen / Then the confirmed value keeps that wall clock and states its zone', () => {
    const onConfirm = vi.fn();
    render(<RescheduleModal currentDate="2024-06-15T00:00:00Z" onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(dateInput(), { target: { value: '2024-06-22' } });
    fireEvent.change(timeInput(), { target: { value: '11:00' } });
    fireEvent.submit(document.querySelector('form')!);

    const sent = onConfirm.mock.calls[0][0] as string;
    expect(sent.startsWith('2024-06-22T11:00:00')).toBe(true);
    expect(sent).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('Given a timed task / When the time is cleared / Then it reverts to a plain calendar date', () => {
    const onConfirm = vi.fn();
    const saved = new Date('2024-06-15T14:30:00').toISOString();
    render(<RescheduleModal currentDate={saved} onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    fireEvent.submit(document.querySelector('form')!);
    expect(onConfirm).toHaveBeenCalledWith('2024-06-15');
  });
});
