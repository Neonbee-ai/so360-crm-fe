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
    { id: 'u1', full_name: 'Alice', email: 'a@test.com' },
    { id: 'u2', full_name: 'Bob', email: 'b@test.com' },
  ]);
});

describe('DealFilters', () => {
  describe('Given the filter panel loads', () => {
    it('When rendered / Then fetches users for the owner dropdown', async () => {
      render(<DealFilters filters={{}} onChange={vi.fn()} />);
      await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());
    });

    it('When users load / Then shows them in the owner dropdown', async () => {
      render(<DealFilters filters={{}} onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });
    });

    it('When rendered with no active filters / Then shows All Time and All Owners defaults', async () => {
      render(<DealFilters filters={{}} onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/all time/i)).toBeInTheDocument();
        expect(screen.getByText(/all owners/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given the user changes the date range', () => {
    it('When Today is selected / Then calls onChange with date_range: today', () => {
      const onChange = vi.fn();
      render(<DealFilters filters={{}} onChange={onChange} />);
      fireEvent.change(screen.getByDisplayValue('All Time'), { target: { value: 'today' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date_range: 'today' }));
    });

    it('When Custom Range is selected / Then calls onChange with date_range: custom', () => {
      const onChange = vi.fn();
      render(<DealFilters filters={{}} onChange={onChange} />);
      fireEvent.change(screen.getByDisplayValue('All Time'), { target: { value: 'custom' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date_range: 'custom' }));
    });

    it('When switching from custom to a preset / Then removes start_date and end_date', () => {
      const onChange = vi.fn();
      render(
        <DealFilters
          filters={{ date_range: 'custom', start_date: '2024-01-01', end_date: '2024-12-31' }}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByDisplayValue('Custom Range'), { target: { value: 'this_month' } });
      const call = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(call.start_date).toBeUndefined();
      expect(call.end_date).toBeUndefined();
    });
  });

  describe('Given the user changes the owner', () => {
    it('When an owner is selected / Then calls onChange with owner_id', async () => {
      const onChange = vi.fn();
      render(<DealFilters filters={{}} onChange={onChange} />);
      await waitFor(() => screen.getByText('Alice'));
      fireEvent.change(screen.getByDisplayValue('All Owners'), { target: { value: 'u1' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'u1' }));
    });

    it('When owner is cleared / Then removes owner_id from filters', async () => {
      const onChange = vi.fn();
      render(<DealFilters filters={{ owner_id: 'u1' }} onChange={onChange} />);
      await waitFor(() => screen.getByText('Alice'));
      fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: '' } });
      const call = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(call.owner_id).toBeUndefined();
    });
  });

  describe('Given the user types a company name', () => {
    it('When text is entered / Then calls onChange with company_name filter', () => {
      const onChange = vi.fn();
      render(<DealFilters filters={{}} onChange={onChange} />);
      fireEvent.change(screen.getByPlaceholderText(/company/i), { target: { value: 'Acme' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ company_name: 'Acme' }));
    });
  });

  describe('Given active filters exist', () => {
    it('When rendered with filters / Then shows a Clear button', () => {
      render(<DealFilters filters={{ owner_id: 'u1' }} onChange={vi.fn()} />);
      expect(screen.getByText(/clear/i)).toBeInTheDocument();
    });

    it('When the Clear button is clicked / Then calls onChange with empty object', () => {
      const onChange = vi.fn();
      render(<DealFilters filters={{ owner_id: 'u1', date_range: 'today' }} onChange={onChange} />);
      fireEvent.click(screen.getByText(/clear/i));
      expect(onChange).toHaveBeenCalledWith({});
    });
  });

  describe('Given no active filters', () => {
    it('When rendered / Then does not show the Clear button', () => {
      render(<DealFilters filters={{}} onChange={vi.fn()} />);
      expect(screen.queryByText(/clear/i)).not.toBeInTheDocument();
    });
  });
});
