import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import Toast, { ToastContainer, useToast } from './Toast';
import type { ToastMessage } from './Toast';

// Mock lucide-react
describe('Given Toast component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const successToast: ToastMessage = {
    id: 'toast-1',
    type: 'success',
    message: 'Operation successful',
  };

  const errorToast: ToastMessage = {
    id: 'toast-2',
    type: 'error',
    message: 'Something went wrong',
  };

  it('When action / Then renders success toast with message', () => {
    render(<Toast toast={successToast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
    expect(screen.getByTestId('icon-CheckCircle')).toBeInTheDocument();
  });

  it('When action / Then renders error toast with message', () => {
    render(<Toast toast={errorToast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByTestId('icon-AlertCircle')).toBeInTheDocument();
  });

  it('When action / Then calls onDismiss after default duration (3000ms)', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={successToast} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('When action / Then calls onDismiss after custom duration', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={successToast} onDismiss={onDismiss} duration={5000} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('When action / Then calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={errorToast} onDismiss={onDismiss} />);

    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledWith('toast-2');
  });

  it('When action / Then applies success styling for success type', () => {
    const { container } = render(<Toast toast={successToast} onDismiss={vi.fn()} />);
    const toastEl = container.querySelector('.border');
    expect(toastEl?.className).toContain('emerald');
  });

  it('When action / Then applies error styling for error type', () => {
    const { container } = render(<Toast toast={errorToast} onDismiss={vi.fn()} />);
    const toastEl = container.querySelector('.border');
    expect(toastEl?.className).toContain('rose');
  });

  it('When action / Then cleans up timer on unmount', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast toast={successToast} onDismiss={onDismiss} />);
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Given ToastContainer', () => {
  it('When action / Then renders nothing when toasts array is empty', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('When action / Then renders multiple toasts', () => {
    const toasts: ToastMessage[] = [
      { id: 't-1', type: 'success', message: 'Saved' },
      { id: 't-2', type: 'error', message: 'Failed' },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('When action / Then passes onDismiss to each toast', () => {
    const onDismiss = vi.fn();
    const toasts: ToastMessage[] = [
      { id: 't-1', type: 'success', message: 'Test' },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);

    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledWith('t-1');
  });
});

describe('Given useToast hook', () => {
  it('When action / Then starts with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('When action / Then showSuccess adds a success toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showSuccess('It worked!');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('It worked!');
  });

  it('When action / Then showError adds an error toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showError('Oops!');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Oops!');
  });

  it('When action / Then showToast adds toast with specified type', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast('error', 'Custom error');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
  });

  it('When action / Then dismissToast removes the toast by id', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showSuccess('First');
      result.current.showError('Second');
    });
    expect(result.current.toasts).toHaveLength(2);

    const idToRemove = result.current.toasts[0].id;
    act(() => {
      result.current.dismissToast(idToRemove);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second');
  });

  it('When action / Then each toast gets a unique id', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showSuccess('A');
      result.current.showSuccess('B');
      result.current.showSuccess('C');
    });
    const ids = result.current.toasts.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it('When action / Then dismissing non-existent id does not affect toasts', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showSuccess('Only one');
    });
    act(() => {
      result.current.dismissToast('nonexistent-id');
    });
    expect(result.current.toasts).toHaveLength(1);
  });
});
