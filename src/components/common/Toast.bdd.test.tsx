import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import Toast, { ToastContainer, useToast } from './Toast';
import type { ToastMessage } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Given a success toast message', () => {
    it('When rendered / Then shows the success message text', () => {
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Saved successfully' };
      render(<Toast toast={toast} onDismiss={vi.fn()} />);
      expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    });

    it('When rendered / Then displays the success icon', () => {
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Done' };
      render(<Toast toast={toast} onDismiss={vi.fn()} />);
      expect(screen.getByTestId('icon-CheckCircle')).toBeInTheDocument();
    });

    it('When rendered / Then uses emerald styling', () => {
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Done' };
      const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
      const toastEl = container.querySelector('.border');
      expect(toastEl?.className).toContain('emerald');
    });

    it('When the default duration elapses / Then auto-dismisses', () => {
      const onDismiss = vi.fn();
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Done' };
      render(<Toast toast={toast} onDismiss={onDismiss} />);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(onDismiss).toHaveBeenCalledWith('t1');
    });

    it('When a custom duration is set and it elapses / Then auto-dismisses after the custom time', () => {
      const onDismiss = vi.fn();
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Done' };
      render(<Toast toast={toast} onDismiss={onDismiss} duration={5000} />);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(onDismiss).toHaveBeenCalledWith('t1');
    });

    it('When the close button is clicked / Then dismisses immediately', () => {
      const onDismiss = vi.fn();
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Done' };
      render(<Toast toast={toast} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onDismiss).toHaveBeenCalledWith('t1');
    });

    it('When unmounted before duration / Then does not call onDismiss', () => {
      const onDismiss = vi.fn();
      const toast: ToastMessage = { id: 't1', type: 'success', message: 'Done' };
      const { unmount } = render(<Toast toast={toast} onDismiss={onDismiss} />);
      unmount();
      act(() => { vi.advanceTimersByTime(5000); });
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Given an error toast message', () => {
    it('When rendered / Then shows the error message text', () => {
      const toast: ToastMessage = { id: 't2', type: 'error', message: 'Something went wrong' };
      render(<Toast toast={toast} onDismiss={vi.fn()} />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('When rendered / Then displays the error icon', () => {
      const toast: ToastMessage = { id: 't2', type: 'error', message: 'Error' };
      render(<Toast toast={toast} onDismiss={vi.fn()} />);
      expect(screen.getByTestId('icon-AlertCircle')).toBeInTheDocument();
    });

    it('When rendered / Then uses rose styling', () => {
      const toast: ToastMessage = { id: 't2', type: 'error', message: 'Error' };
      const { container } = render(<Toast toast={toast} onDismiss={vi.fn()} />);
      const toastEl = container.querySelector('.border');
      expect(toastEl?.className).toContain('rose');
    });
  });
});

describe('ToastContainer', () => {
  describe('Given an empty toasts array', () => {
    it('When rendered / Then renders nothing', () => {
      const { container } = render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Given multiple toasts', () => {
    it('When rendered / Then shows all toast messages', () => {
      const toasts: ToastMessage[] = [
        { id: 't1', type: 'success', message: 'Saved' },
        { id: 't2', type: 'error', message: 'Failed' },
      ];
      render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);
      expect(screen.getByText('Saved')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('When a close button is clicked / Then calls onDismiss with the correct id', () => {
      const onDismiss = vi.fn();
      const toasts: ToastMessage[] = [{ id: 't-abc', type: 'success', message: 'Test' }];
      render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onDismiss).toHaveBeenCalledWith('t-abc');
    });
  });
});

describe('useToast hook', () => {
  describe('Given a fresh hook instance', () => {
    it('When initialized / Then starts with no toasts', () => {
      const { result } = renderHook(() => useToast());
      expect(result.current.toasts).toEqual([]);
    });
  });

  describe('Given a user shows a success toast', () => {
    it('When showSuccess is called / Then adds a success toast to the list', () => {
      const { result } = renderHook(() => useToast());
      act(() => { result.current.showSuccess('Operation complete'); });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toasts[0].message).toBe('Operation complete');
    });
  });

  describe('Given a user shows an error toast', () => {
    it('When showError is called / Then adds an error toast to the list', () => {
      const { result } = renderHook(() => useToast());
      act(() => { result.current.showError('Something failed'); });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[0].message).toBe('Something failed');
    });
  });

  describe('Given multiple toasts exist', () => {
    it('When dismissToast is called with an id / Then removes only that toast', () => {
      const { result } = renderHook(() => useToast());
      act(() => {
        result.current.showSuccess('First');
        result.current.showError('Second');
      });
      const idToRemove = result.current.toasts[0].id;
      act(() => { result.current.dismissToast(idToRemove); });
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Second');
    });

    it('When each toast is added / Then each gets a unique id', () => {
      const { result } = renderHook(() => useToast());
      act(() => {
        result.current.showSuccess('A');
        result.current.showSuccess('B');
        result.current.showSuccess('C');
      });
      const ids = result.current.toasts.map((t) => t.id);
      expect(new Set(ids).size).toBe(3);
    });
  });
});
