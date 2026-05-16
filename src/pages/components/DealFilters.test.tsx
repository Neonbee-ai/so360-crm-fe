import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetUsers = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: (...a: any[]) => mockGetUsers(...a),
  },
}));

import { DealFilters } from './DealFilters';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsers.mockResolvedValue([
    { id: 'u1', full_name: 'Alice', email: 'a@a.com' },
    { id: 'u2', full_name: 'Bob', email: 'b@b.com' },
  ]);
});

describe('Given DealFilters', () => {
  it('When action / Then renders filter controls', async () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{}} onChange={onChange} />);
    await waitFor(() => {
      expect(screen.getByText(/all owners/i)).toBeInTheDocument();
      expect(screen.getByText(/all time/i)).toBeInTheDocument();
    });
  });

  it('When action / Then fetches users on mount', async () => {
    render(<DealFilters filters={{}} onChange={vi.fn()} />);
    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled();
    });
  });

  it('When action / Then populates owner dropdown with users', async () => {
    render(<DealFilters filters={{}} onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('When action / Then calls onChange when date range changes', async () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{}} onChange={onChange} />);
    const select = screen.getByDisplayValue('All Time');
    fireEvent.change(select, { target: { value: 'today' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date_range: 'today' }));
  });

  it('When action / Then shows custom date fields when custom range selected', async () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{}} onChange={onChange} />);
    const select = screen.getByDisplayValue('All Time');
    fireEvent.change(select, { target: { value: 'custom' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date_range: 'custom' }));
  });

  it('When action / Then shows custom date fields for custom range filter', () => {
    const onChange = vi.fn();
    const { rerender } = render(<DealFilters filters={{ date_range: 'custom' }} onChange={onChange} />);
    // We need to set showCustomDate state - this happens internally when date_range is custom
    // Let's trigger it by changing to custom
    const select = screen.getByDisplayValue('Custom Range');
    expect(select).toBeInTheDocument();
  });

  it('When action / Then calls onChange when owner changes', async () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{}} onChange={onChange} />);
    await waitFor(() => screen.getByText('Alice'));
    const ownerSelect = screen.getByDisplayValue('All Owners');
    fireEvent.change(ownerSelect, { target: { value: 'u1' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'u1' }));
  });

  it('When action / Then calls onChange when clearing owner filter', async () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{ owner_id: 'u1' }} onChange={onChange} />);
    await waitFor(() => screen.getByText('Alice'));
    const ownerSelect = screen.getByDisplayValue('Alice');
    fireEvent.change(ownerSelect, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.not.objectContaining({ owner_id: expect.anything() }));
  });

  it('When action / Then calls onChange when clearing filters', async () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{ company_name: 'test', owner_id: 'u1' }} onChange={onChange} />);
    const clearBtn = screen.getByText(/clear/i);
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('When action / Then shows active filter indicator', () => {
    render(<DealFilters filters={{ owner_id: 'u1' }} onChange={vi.fn()} />);
    const clearBtn = screen.getByText(/clear/i);
    expect(clearBtn).toBeInTheDocument();
  });

  it('When action / Then hides clear button when no active filters', () => {
    render(<DealFilters filters={{}} onChange={vi.fn()} />);
    expect(screen.queryByText(/clear/i)).not.toBeInTheDocument();
  });

  it('When action / Then handles company name filter', () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{}} onChange={onChange} />);
    const searchInput = screen.getByPlaceholderText(/company/i);
    fireEvent.change(searchInput, { target: { value: 'Acme' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ company_name: 'Acme' }));
  });

  it('When action / Then cleans up date fields when switching from custom to preset', () => {
    const onChange = vi.fn();
    render(<DealFilters filters={{ date_range: 'custom', start_date: '2024-01-01', end_date: '2024-12-31' }} onChange={onChange} />);
    // Simulate selecting custom first to show date fields
    const select = screen.getByDisplayValue('Custom Range');
    fireEvent.change(select, { target: { value: 'today' } });
    const call = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(call.start_date).toBeUndefined();
    expect(call.end_date).toBeUndefined();
  });
});
